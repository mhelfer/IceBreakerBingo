// Integration test: requires local Supabase running at 127.0.0.1:54321.
// Skipped automatically when unreachable so CI/pure-unit runs stay green.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";
import { generateCards } from "@/lib/cardGenIO";
import {
  DISCOVERY_CAP,
  FREE_POSITION,
  TOTAL_SQUARES,
} from "@/lib/cardGen";
import { generateEventCode, generate96BitToken } from "@/lib/ids";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// No fallback — set SUPABASE_SERVICE_ROLE_KEY in your env (see .env.local).
// Missing key is treated the same as an unreachable Supabase: skip the suite.
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

// 15 players × 8 single-select questions (4 options each). Bucket sizes
// per question: 4/4/4/3, so every option has ≥3 non-self matchers for every
// player (own bucket filtered out by the self-exclusion rule). That gives
// each player exactly 3 eligible cohort traits per question × 8 = 24. Plus
// 1 discovery question answered by all 15.
const PLAYER_COUNT = 15;
const QUESTION_COUNT = 8;
const OPTIONS = ["A", "B", "C", "D"] as const;

// Rotate the small-bucket across questions so matcher distribution isn't
// identical per question — helps catch bugs that depend on order.
function pickOne(playerIdx: number, questionIdx: number): string {
  const bucket = (playerIdx + questionIdx) % PLAYER_COUNT;
  // 0..3 → A, 4..7 → B, 8..11 → C, 12..14 → D (size 3)
  if (bucket < 4) return "A";
  if (bucket < 8) return "B";
  if (bucket < 12) return "C";
  return "D";
}

describeIf("generateCards (local Supabase)", () => {
  let supabase: SupabaseClient<Database>;
  let eventId: string;
  const cleanupIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `cg-it-${Date.now()}@example.com`;
    const { data: fac } = await supabase
      .from("facilitators")
      .insert({ email, password_hash: "scrypt$a$b" })
      .select("id")
      .single();
    if (!fac) throw new Error("facilitator insert failed");

    const { data: ev } = await supabase
      .from("events")
      .insert({
        facilitator_id: fac.id,
        code: generateEventCode(),
        name: "card-gen-it",
        state: "curation_locked",
      })
      .select("id")
      .single();
    if (!ev) throw new Error("event insert failed");
    eventId = ev.id;
    cleanupIds.push(eventId);

    const playerInserts = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
      event_id: eventId,
      display_name: `P${i}`,
      access_code: generate96BitToken(),
      qr_nonce: generate96BitToken(),
      survey_submitted_at: new Date().toISOString(),
    }));
    const { data: players } = await supabase
      .from("players")
      .insert(playerInserts)
      .select("id");
    if (!players) throw new Error("player insert failed");

    // 8 single-select cohort questions + 1 discovery question. Inserted as
    // two separate calls because the union type on the `type` column
    // narrows awkwardly when mixed.
    const cohortQuestionRows = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
      event_id: eventId,
      prompt: `Q${i}: pick one`,
      type: "single" as const,
      options: [...OPTIONS],
      position: i,
    }));
    const { data: cohortQuestions } = await supabase
      .from("survey_questions")
      .insert(cohortQuestionRows)
      .select("id, position")
      .order("position");
    if (!cohortQuestions) throw new Error("cohort question insert failed");

    const { data: discoveryQuestion } = await supabase
      .from("survey_questions")
      .insert({
        event_id: eventId,
        prompt: "Hidden talent?",
        type: "text",
        options: null,
        position: QUESTION_COUNT,
      })
      .select("id")
      .single();
    if (!discoveryQuestion) throw new Error("discovery question insert failed");

    // 4 cohort traits per question (one per option), plus 1 discovery trait.
    const traitRows = [
      ...cohortQuestions.flatMap((q, qi) =>
        OPTIONS.map((opt) => ({
          event_id: eventId,
          question_id: q.id,
          kind: "cohort" as const,
          match_rule: { op: "eq", value: opt },
          square_text: `Q${qi}-${opt}`.slice(0, 36),
          conversation_prompt: `Ask about ${opt}.`,
          enabled: true,
        })),
      ),
      {
        event_id: eventId,
        question_id: discoveryQuestion.id,
        kind: "discovery" as const,
        match_rule: null,
        square_text: "Learn hidden talent",
        conversation_prompt: null,
        enabled: true,
      },
    ];
    const { error: tErr } = await supabase
      .from("trait_templates")
      .insert(traitRows);
    if (tErr) throw new Error(tErr.message);

    // Responses: each player picks 2 options per multi question + a unique
    // talent answer for the discovery question.
    const responses: Array<{
      player_id: string;
      question_id: string;
      value: unknown;
    }> = [];
    for (let pi = 0; pi < players.length; pi++) {
      for (let qi = 0; qi < cohortQuestions.length; qi++) {
        responses.push({
          player_id: players[pi].id,
          question_id: cohortQuestions[qi].id,
          value: pickOne(pi, qi),
        });
      }
      responses.push({
        player_id: players[pi].id,
        question_id: discoveryQuestion.id,
        value: `talent-${pi}`,
      });
    }

    const { error: rErr } = await supabase
      .from("survey_responses")
      .insert(responses);
    if (rErr) throw new Error(rErr.message);
  }, 30_000);

  afterAll(async () => {
    await supabase.from("events").delete().in("id", cleanupIds);
  });

  it("generates cards for all non-absent players with the expected shape", async () => {
    const report = await generateCards(supabase, eventId);
    expect(report.cardsGenerated).toBe(PLAYER_COUNT);
    expect(report.playersSkipped).toEqual([]);

    const { data: playerRows } = await supabase
      .from("players")
      .select("id")
      .eq("event_id", eventId);
    const playerIds = (playerRows ?? []).map((p) => p.id);

    const { data: cards } = await supabase
      .from("cards")
      .select("id, player_id")
      .in("player_id", playerIds);
    expect(cards).toHaveLength(PLAYER_COUNT);

    for (const card of cards ?? []) {
      const { data: squares } = await supabase
        .from("card_squares")
        .select("position, trait_template_id")
        .eq("card_id", card.id);
      expect(squares).toHaveLength(25);
      const positions = (squares ?? [])
        .map((s) => s.position)
        .sort((a, b) => a - b);
      expect(positions).toEqual(Array.from({ length: 25 }, (_, i) => i));
      const free = (squares ?? []).find(
        (s) => s.position === FREE_POSITION,
      );
      expect(free?.trait_template_id).toBeNull();

      const traitSquares = (squares ?? []).filter(
        (s) => s.position !== FREE_POSITION,
      );
      expect(traitSquares).toHaveLength(TOTAL_SQUARES);
      const ids = traitSquares.map((s) => s.trait_template_id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never places a disabled trait on any card", async () => {
    // Disable one cohort trait and re-run; it must not appear on any card.
    const { data: traitRow } = await supabase
      .from("trait_templates")
      .select("id")
      .eq("event_id", eventId)
      .eq("kind", "cohort")
      .limit(1)
      .single();
    if (!traitRow) throw new Error("no trait to disable");
    await supabase
      .from("trait_templates")
      .update({ enabled: false })
      .eq("id", traitRow.id);

    await generateCards(supabase, eventId);

    const { data: players } = await supabase
      .from("players")
      .select("id")
      .eq("event_id", eventId);
    const { data: placements } = await supabase
      .from("card_squares")
      .select("trait_template_id, cards!inner(player_id)")
      .in("cards.player_id", (players ?? []).map((p) => p.id))
      .not("trait_template_id", "is", null);
    for (const row of placements ?? []) {
      expect(row.trait_template_id).not.toBe(traitRow.id);
    }

    // Re-enable for the next test.
    await supabase
      .from("trait_templates")
      .update({ enabled: true })
      .eq("id", traitRow.id);
  });

  it("caps discovery squares per card and never repeats a question", async () => {
    await generateCards(supabase, eventId);
    const { data: players } = await supabase
      .from("players")
      .select("id")
      .eq("event_id", eventId);

    for (const p of players ?? []) {
      const { data: card } = await supabase
        .from("cards")
        .select("id")
        .eq("player_id", p.id)
        .single();
      expect(card).toBeTruthy();
      const { data: squares } = await supabase
        .from("card_squares")
        .select("trait_template_id, trait_templates(kind, question_id)")
        .eq("card_id", card!.id)
        .not("trait_template_id", "is", null);
      const discovery = (squares ?? []).filter((s) => {
        const t = s.trait_templates as { kind: string } | null;
        return t?.kind === "discovery";
      });
      expect(discovery.length).toBeLessThanOrEqual(DISCOVERY_CAP);
      const qids = discovery.map(
        (s) => (s.trait_templates as { question_id: string }).question_id,
      );
      expect(new Set(qids).size).toBe(qids.length);
    }
  });
});
