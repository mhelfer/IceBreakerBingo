// I/O shell around lib/cardGen.ts. Loads data, builds the matcher index,
// samples each player's card, writes everything in one pass.
//
// Called from the Start Game server action after the facilitator marks
// attendance. Assumes the event is in `curation_locked` state — caller
// flips to `live` after this returns.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db-types";
import {
  FREE_POSITION,
  assembleCardPositions,
  buildMatcherIndex,
  eligibleTraitsForPlayer,
  sampleCardSquares,
  type MatcherIndex,
  type QuestionInfo,
  type ResponseRecord,
  type TraitTemplateRecord,
} from "./cardGen";
import type { MatchRule } from "./traits";
import type { ResponseValue } from "./curation";

type Admin = SupabaseClient<Database>;

export type CardGenReport = {
  cardsGenerated: number;
  playersSkipped: string[]; // absent players — no card made
  perPlayer: Array<{ playerId: string; cohort: number; discovery: number }>;
};

export async function generateCards(
  supabase: Admin,
  eventId: string,
): Promise<CardGenReport> {
  const [
    { data: players, error: pErr },
    { data: questions, error: qErr },
    { data: traits, error: tErr },
    { data: responses, error: rErr },
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id, absent")
      .eq("event_id", eventId),
    supabase
      .from("survey_questions")
      .select("id, type")
      .eq("event_id", eventId),
    supabase
      .from("trait_templates")
      .select("id, question_id, kind, match_rule, enabled")
      .eq("event_id", eventId)
      .eq("enabled", true),
    supabase
      .from("survey_responses")
      .select("player_id, question_id, value, players!inner(event_id)")
      .eq("players.event_id", eventId),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (qErr) throw new Error(qErr.message);
  if (tErr) throw new Error(tErr.message);
  if (rErr) throw new Error(rErr.message);

  const allPlayers = (players ?? []) as { id: string; absent: boolean }[];
  const questionInfos: QuestionInfo[] = (questions ?? []).map((q) => ({
    id: q.id,
    type: q.type,
  }));
  const traitRecords: TraitTemplateRecord[] = (traits ?? []).map((t) => ({
    id: t.id,
    question_id: t.question_id,
    kind: t.kind,
    enabled: t.enabled,
    match_rule: (t.match_rule as MatchRule | null) ?? null,
  }));
  const responseRecords: ResponseRecord[] = (responses ?? []).map((r) => ({
    player_id: r.player_id,
    question_id: r.question_id,
    value: r.value as ResponseValue,
  }));

  const nonAbsentPlayers = new Set(
    allPlayers.filter((p) => !p.absent).map((p) => p.id),
  );

  const matchers: MatcherIndex = buildMatcherIndex({
    questions: questionInfos,
    traits: traitRecords,
    responses: responseRecords,
  });

  // Rewrite player_traits from scratch — the materialization is derived state.
  const playerTraitRows: { player_id: string; trait_template_id: string }[] = [];
  for (const [traitId, playerSet] of matchers.entries()) {
    for (const pid of playerSet) {
      playerTraitRows.push({
        player_id: pid,
        trait_template_id: traitId,
      });
    }
  }
  await rewritePlayerTraits(supabase, eventId, playerTraitRows);

  // Drop any previous cards for this event so re-runs are idempotent.
  const playerIds = allPlayers.map((p) => p.id);
  if (playerIds.length > 0) {
    const del = await supabase
      .from("cards")
      .delete()
      .in("player_id", playerIds);
    if (del.error) throw new Error(del.error.message);
  }

  const report: CardGenReport = {
    cardsGenerated: 0,
    playersSkipped: [],
    perPlayer: [],
  };

  for (const p of allPlayers) {
    if (p.absent) {
      report.playersSkipped.push(p.id);
      continue;
    }
    const eligible = eligibleTraitsForPlayer({
      playerId: p.id,
      traits: traitRecords,
      matchers,
      nonAbsentPlayers,
    });
    let sampled;
    try {
      sampled = sampleCardSquares({ eligible });
    } catch (err) {
      throw new Error(
        `Card gen failed for player ${p.id}: ${(err as Error).message}`,
      );
    }
    const placed = assembleCardPositions(sampled);

    const { data: card, error: cErr } = await supabase
      .from("cards")
      .insert({ player_id: p.id })
      .select("id")
      .single();
    if (cErr || !card) throw new Error(cErr?.message ?? "card insert failed");

    const squareRows = [
      ...placed.map((ps) => ({
        card_id: card.id,
        position: ps.position,
        trait_template_id: ps.trait.id,
      })),
      {
        card_id: card.id,
        position: FREE_POSITION,
        trait_template_id: null,
      },
    ];
    const { error: sErr } = await supabase
      .from("card_squares")
      .insert(squareRows);
    if (sErr) throw new Error(sErr.message);

    report.cardsGenerated++;
    report.perPlayer.push({
      playerId: p.id,
      cohort: sampled.filter((t) => t.kind === "cohort").length,
      discovery: sampled.filter((t) => t.kind === "discovery").length,
    });
  }

  return report;
}

async function rewritePlayerTraits(
  supabase: Admin,
  eventId: string,
  rows: { player_id: string; trait_template_id: string }[],
): Promise<void> {
  // Load the player IDs for this event — delete via player_id scope.
  const { data: ps, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("event_id", eventId);
  if (pErr) throw new Error(pErr.message);
  const ids = (ps ?? []).map((p) => p.id);
  if (ids.length > 0) {
    const del = await supabase
      .from("player_traits")
      .delete()
      .in("player_id", ids);
    if (del.error) throw new Error(del.error.message);
  }
  if (rows.length === 0) return;

  // Insert in chunks to avoid huge payloads.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("player_traits").insert(chunk);
    if (error) throw new Error(error.message);
  }
}
