// Integration test: requires local Supabase running at 127.0.0.1:54321.
// Skipped automatically when unreachable so CI/pure-unit runs stay green.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";
import { generateEventCode, generate96BitToken } from "@/lib/ids";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function supabaseReachable(): Promise<boolean> {
  if (!key) return false;
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(500),
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const reachable = await supabaseReachable();
const describeIf = reachable ? describe : describe.skip;

// The server actions import `requireFacilitator` (reads cookies) and
// `revalidatePath` (Next.js request context). In a vitest process there's
// no request context, so both blow up without mocks. Stub them out before
// importing the actions module.
const testFacilitatorId = { current: "" };

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>(
    "@/lib/session",
  );
  return {
    ...actual,
    requireFacilitator: async () => ({
      kind: "facilitator",
      facilitator_id: testFacilitatorId.current,
      iat: 0,
    }),
    readFacilitatorSession: async () => ({
      kind: "facilitator",
      facilitator_id: testFacilitatorId.current,
      iat: 0,
    }),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const {
  renamePlayer,
  removePlayer,
  rotateAccessCode,
} = await import("@/app/admin/[eventCode]/actions");

type EventState = Database["public"]["Enums"]["event_state"];

describeIf("roster actions (local Supabase)", () => {
  let supabase: SupabaseClient<Database>;
  let facilitatorId: string;
  let otherFacilitatorId: string;
  const eventIds: string[] = [];

  async function createEventInState(state: EventState): Promise<{
    eventId: string;
    code: string;
    playerId: string;
    access_code: string;
    qr_nonce: string;
  }> {
    const code = generateEventCode();
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .insert({
        facilitator_id: facilitatorId,
        code,
        name: `roster-it-${state}`,
        state,
      })
      .select("id, code")
      .single();
    if (evErr || !ev) throw new Error(`event insert failed: ${evErr?.message}`);
    eventIds.push(ev.id);

    const access_code = generate96BitToken();
    const qr_nonce = generate96BitToken();
    const { data: pl, error: plErr } = await supabase
      .from("players")
      .insert({
        event_id: ev.id,
        display_name: "Original Name",
        access_code,
        qr_nonce,
      })
      .select("id")
      .single();
    if (plErr || !pl) throw new Error(`player insert failed: ${plErr?.message}`);

    return { eventId: ev.id, code: ev.code, playerId: pl.id, access_code, qr_nonce };
  }

  async function readPlayer(id: string) {
    const { data } = await supabase
      .from("players")
      .select("id, display_name, access_code, qr_nonce")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  beforeAll(async () => {
    supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: fac } = await supabase
      .from("facilitators")
      .insert({
        email: `roster-it-${Date.now()}@example.com`,
        password_hash: "scrypt$a$b",
      })
      .select("id")
      .single();
    if (!fac) throw new Error("facilitator insert failed");
    facilitatorId = fac.id;

    const { data: other } = await supabase
      .from("facilitators")
      .insert({
        email: `roster-it-other-${Date.now()}@example.com`,
        password_hash: "scrypt$a$b",
      })
      .select("id")
      .single();
    if (!other) throw new Error("other facilitator insert failed");
    otherFacilitatorId = other.id;
  }, 30_000);

  beforeEach(() => {
    testFacilitatorId.current = facilitatorId;
  });

  afterAll(async () => {
    await supabase.from("events").delete().in("id", eventIds);
    await supabase
      .from("facilitators")
      .delete()
      .in("id", [facilitatorId, otherFacilitatorId]);
  });

  describe("renamePlayer", () => {
    it("updates display_name in draft", async () => {
      const { code, playerId } = await createEventInState("draft");
      await renamePlayer(code, playerId, "New Name");
      expect((await readPlayer(playerId))?.display_name).toBe("New Name");
    });

    it("updates display_name in survey_open", async () => {
      const { code, playerId } = await createEventInState("survey_open");
      await renamePlayer(code, playerId, "Renamed");
      expect((await readPlayer(playerId))?.display_name).toBe("Renamed");
    });

    it("trims whitespace", async () => {
      const { code, playerId } = await createEventInState("draft");
      await renamePlayer(code, playerId, "   Padded   ");
      expect((await readPlayer(playerId))?.display_name).toBe("Padded");
    });

    it("rejects empty name", async () => {
      const { code, playerId } = await createEventInState("draft");
      await expect(renamePlayer(code, playerId, "   ")).rejects.toThrow(
        /empty/i,
      );
    });

    it.each<EventState>(["survey_closed", "curation_locked", "live", "ended"])(
      "rejects in %s",
      async (state) => {
        const { code, playerId } = await createEventInState(state);
        await expect(renamePlayer(code, playerId, "Nope")).rejects.toThrow(
          /survey closes/i,
        );
        expect((await readPlayer(playerId))?.display_name).toBe("Original Name");
      },
    );

    it("rejects when event belongs to a different facilitator", async () => {
      const { code, playerId } = await createEventInState("draft");
      testFacilitatorId.current = otherFacilitatorId;
      await expect(renamePlayer(code, playerId, "Hack")).rejects.toThrow(
        /EVENT_NOT_FOUND/,
      );
      expect((await readPlayer(playerId))?.display_name).toBe("Original Name");
    });
  });

  describe("removePlayer", () => {
    it("deletes the row in draft", async () => {
      const { code, playerId } = await createEventInState("draft");
      await removePlayer(code, playerId);
      expect(await readPlayer(playerId)).toBeNull();
    });

    it("deletes the row in survey_open", async () => {
      const { code, playerId } = await createEventInState("survey_open");
      await removePlayer(code, playerId);
      expect(await readPlayer(playerId)).toBeNull();
    });

    it.each<EventState>(["survey_closed", "curation_locked", "live", "ended"])(
      "rejects in %s",
      async (state) => {
        const { code, playerId } = await createEventInState(state);
        await expect(removePlayer(code, playerId)).rejects.toThrow(
          /survey closes/i,
        );
        expect(await readPlayer(playerId)).not.toBeNull();
      },
    );
  });

  describe("rotateAccessCode", () => {
    it("rotates both access_code and qr_nonce", async () => {
      const { code, playerId, access_code, qr_nonce } =
        await createEventInState("survey_open");
      await rotateAccessCode(code, playerId);
      const after = await readPlayer(playerId);
      expect(after?.access_code).not.toBe(access_code);
      expect(after?.qr_nonce).not.toBe(qr_nonce);
      expect(after?.access_code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(after?.qr_nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it.each<EventState>([
      "draft",
      "survey_open",
      "survey_closed",
      "curation_locked",
      "live",
    ])("allows in %s", async (state) => {
      const { code, playerId, access_code } = await createEventInState(state);
      await rotateAccessCode(code, playerId);
      expect((await readPlayer(playerId))?.access_code).not.toBe(access_code);
    });

    it("rejects in ended", async () => {
      const { code, playerId, access_code } = await createEventInState("ended");
      await expect(rotateAccessCode(code, playerId)).rejects.toThrow(
        /ended/i,
      );
      expect((await readPlayer(playerId))?.access_code).toBe(access_code);
    });
  });
});
