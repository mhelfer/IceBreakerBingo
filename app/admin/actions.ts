"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  clearFacilitatorSession,
  requireFacilitator,
  setSession,
} from "@/lib/session";
import { generateEventCode } from "@/lib/ids";

const emailSchema = z.string().email().max(254).transform((v) => v.toLowerCase().trim());
const passwordSchema = z.string().min(8).max(200);

export async function signUp(formData: FormData): Promise<void> {
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));

  const supabase = getSupabaseAdmin();
  const existing = await supabase
    .from("facilitators")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing.data) {
    throw new Error("An account with that email already exists. Sign in instead.");
  }

  const password_hash = await hashPassword(password);
  const insert = await supabase
    .from("facilitators")
    .insert({ email, password_hash })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new Error(insert.error?.message ?? "Failed to create account");
  }

  await setSession({
    kind: "facilitator",
    facilitator_id: insert.data.id,
    iat: Math.floor(Date.now() / 1000),
  });
  redirect("/admin");
}

export async function signIn(formData: FormData): Promise<void> {
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));

  const supabase = getSupabaseAdmin();
  const row = await supabase
    .from("facilitators")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (!row.data || !(await verifyPassword(password, row.data.password_hash))) {
    throw new Error("Wrong email or password.");
  }

  await setSession({
    kind: "facilitator",
    facilitator_id: row.data.id,
    iat: Math.floor(Date.now() / 1000),
  });
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await clearFacilitatorSession();
  redirect("/admin/login");
}

const eventNameSchema = z.string().trim().min(1).max(120);
const codeSchema = z.string().trim().toUpperCase().min(4).max(12);

export async function createEvent(formData: FormData): Promise<void> {
  const session = await requireFacilitator();

  const name = eventNameSchema.parse(formData.get("name"));
  const startsAtRaw = formData.get("starts_at");
  const starts_at =
    typeof startsAtRaw === "string" && startsAtRaw.trim() !== ""
      ? new Date(startsAtRaw).toISOString()
      : null;

  const supabase = getSupabaseAdmin();

  // Retry a few times on unique-code collision (extremely rare in a fresh DB).
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateEventCode();
    const insert = await supabase
      .from("events")
      .insert({
        facilitator_id: session.facilitator_id,
        code,
        name,
        starts_at,
      })
      .select("code")
      .single();

    if (!insert.error && insert.data) {
      redirect(`/admin/${insert.data.code}`);
    }
    // 23505 = unique_violation. Retry on code collision; bail on anything else.
    if (insert.error && insert.error.code !== "23505") {
      throw new Error(insert.error.message);
    }
  }
  throw new Error("Could not allocate a unique event code. Try again.");
}

export async function deleteEvent(eventCode: string): Promise<void> {
  const session = await requireFacilitator();
  const code = codeSchema.parse(eventCode);
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("code", code)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();
  if (!event) throw new Error("Event not found");

  // Gather IDs to manually clear RESTRICT-blocked foreign keys before deletion.
  const { data: playerRows } = await supabase
    .from("players")
    .select("id")
    .eq("event_id", event.id);
  const playerIds = playerRows?.map((r) => r.id) ?? [];

  if (playerIds.length > 0) {
    const { data: cardRows } = await supabase
      .from("cards")
      .select("id")
      .in("player_id", playerIds);
    const cardIds = cardRows?.map((r) => r.id) ?? [];

    if (cardIds.length > 0) {
      const { data: claimRows } = await supabase
        .from("claims")
        .select("id")
        .in("card_id", cardIds);
      const claimIds = claimRows?.map((r) => r.id) ?? [];

      if (claimIds.length > 0) {
        // bingos.triggering_claim_id is RESTRICT — must go before claims
        await supabase.from("bingos").delete().in("triggering_claim_id", claimIds);
        // claims.via_player_id and claims.trait_template_id are RESTRICT
        await supabase.from("claims").delete().in("id", claimIds);
      }
      // card_squares.trait_template_id is RESTRICT
      await supabase.from("card_squares").delete().in("card_id", cardIds);
    }
  }

  // Cascade handles the rest: players, cards, survey_questions,
  // trait_templates, prize_awards, survey_responses, player_traits.
  await supabase.from("events").delete().eq("id", event.id);
  redirect("/admin");
}
