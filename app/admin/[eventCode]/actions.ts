"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireFacilitator } from "@/lib/session";
import { parseCsv } from "@/lib/csv";
import { generate96BitToken } from "@/lib/ids";
import {
  STARTER_QUESTIONS,
  TEXT_ANSWER_POOLS,
  GENERIC_TEXT_POOL,
} from "@/lib/questionTemplate";
import { seedsForQuestion, type MatchRule } from "@/lib/traits";
import { generateCards } from "@/lib/cardGenIO";
import { fastestBingoWinners, unluckiestWinners } from "@/lib/prizes";

const codeSchema = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .transform((v) => v.toUpperCase());

const uuidSchema = z.string().uuid();

async function loadOwnedEvent(eventCode: string) {
  const session = await requireFacilitator();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id, code, state, facilitator_id")
    .eq("code", codeSchema.parse(eventCode))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("EVENT_NOT_FOUND");
  if (data.facilitator_id !== session.facilitator_id) {
    throw new Error("EVENT_NOT_FOUND"); // Don't advertise existence.
  }
  return { supabase, event: data };
}

// ─── state transitions ─────────────────────────────────────────────────────

export async function openSurvey(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error(`Can't open survey from state ${event.state}.`);
  }

  const [{ count: pCount }, { count: qCount }] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id),
    supabase
      .from("survey_questions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id),
  ]);
  if ((pCount ?? 0) === 0) {
    throw new Error("Upload a roster before opening the survey.");
  }
  if ((qCount ?? 0) === 0) {
    throw new Error("Add at least one question before opening the survey.");
  }

  const { error } = await supabase
    .from("events")
    .update({ state: "survey_open", survey_opened_at: new Date().toISOString() })
    .eq("id", event.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}`);
}

export async function closeSurvey(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "survey_open") {
    throw new Error(`Can't close survey from state ${event.state}.`);
  }
  const { error } = await supabase
    .from("events")
    .update({ state: "survey_closed", survey_closed_at: new Date().toISOString() })
    .eq("id", event.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${event.code}`);
}

export async function reopenSurvey(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "survey_closed") {
    throw new Error(`Can't reopen from state ${event.state}.`);
  }
  const { error } = await supabase
    .from("events")
    .update({ state: "survey_open" })
    .eq("id", event.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${event.code}`);
}

export async function setPlayerAbsent(
  eventCode: string,
  playerId: string,
  absent: boolean,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "curation_locked") {
    throw new Error("Attendance gate is only open after Lock Curation.");
  }
  const id = uuidSchema.parse(playerId);
  const { error } = await supabase
    .from("players")
    .update({ absent })
    .eq("id", id)
    .eq("event_id", event.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${event.code}/start`);
}

export async function startGame(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "curation_locked") {
    throw new Error(`Can't start game from state ${event.state}.`);
  }

  const report = await generateCards(supabase, event.id);
  if (report.cardsGenerated === 0) {
    throw new Error("No cards generated — mark at least one player present.");
  }

  const { error } = await supabase
    .from("events")
    .update({ state: "live", started_at: new Date().toISOString() })
    .eq("id", event.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}`);
  revalidatePath(`/admin/${event.code}/start`);
  redirect(`/facilitate/${event.code}`);
}

export async function remintAccessCode(
  eventCode: string,
  playerId: string,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state === "ended") {
    throw new Error("Event has ended.");
  }
  const id = uuidSchema.parse(playerId);
  const { error } = await supabase
    .from("players")
    .update({
      access_code: generate96BitToken(),
      qr_nonce: generate96BitToken(),
    })
    .eq("id", id)
    .eq("event_id", event.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${event.code}`);
}

export async function setReuseUnlocked(
  eventCode: string,
  unlocked: boolean,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "live") {
    throw new Error("Reuse toggle only works while the game is live.");
  }
  const { error } = await supabase
    .from("events")
    .update({
      reuse_unlocked: unlocked,
      reuse_unlocked_at: unlocked ? new Date().toISOString() : null,
    })
    .eq("id", event.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/facilitate/${event.code}`);
}

export async function setShowAllMatches(
  eventCode: string,
  enabled: boolean,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "live") {
    throw new Error("Match mode toggle only works while the game is live.");
  }
  const { error } = await supabase
    .from("events")
    .update({ show_all_matches: enabled })
    .eq("id", event.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/facilitate/${event.code}`);
}

export async function endGame(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "live" && event.state !== "ended") {
    throw new Error(`Can't end game from state ${event.state}.`);
  }

  // Freeze state first so new claims are rejected while we compute.
  // If already ended (re-entry for prize recovery), skip the state update.
  if (event.state === "live") {
    const endedAt = new Date().toISOString();
    const { data: updated, error: stateErr } = await supabase
      .from("events")
      .update({ state: "ended", ended_at: endedAt })
      .eq("id", event.id)
      .eq("state", "live") // CAS: only transition if still live
      .select("id")
      .maybeSingle();
    if (stateErr) throw new Error(stateErr.message);
    if (!updated) {
      // Another call already transitioned — skip prize computation.
      revalidatePath(`/facilitate/${event.code}`);
      revalidatePath(`/admin/${event.code}`);
      return;
    }
  }

  // Pull the frozen inputs.
  const { data: players } = await supabase
    .from("players")
    .select("id, absent")
    .eq("event_id", event.id);
  const eligiblePlayers = (players ?? []).filter((p) => !p.absent);

  const { data: cards } = await supabase
    .from("cards")
    .select("id, player_id")
    .in(
      "player_id",
      eligiblePlayers.map((p) => p.id),
    );
  const cardIdByPlayer = new Map(
    (cards ?? []).map((c) => [c.player_id, c.id]),
  );
  const cardIds = (cards ?? []).map((c) => c.id);

  const { data: claims } = await supabase
    .from("claims")
    .select("card_id, claimed_at")
    .in("card_id", cardIds.length > 0 ? cardIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: bingos } = await supabase
    .from("bingos")
    .select("player_id, completed_at")
    .in("player_id", eligiblePlayers.map((p) => p.id));

  const firstClaimByCard = new Map<string, number>();
  const totalClaimsByCard = new Map<string, number>();
  for (const c of claims ?? []) {
    const t = Date.parse(c.claimed_at);
    const prev = firstClaimByCard.get(c.card_id);
    if (prev === undefined || t < prev) firstClaimByCard.set(c.card_id, t);
    totalClaimsByCard.set(c.card_id, (totalClaimsByCard.get(c.card_id) ?? 0) + 1);
  }
  const firstBingoByPlayer = new Map<string, number>();
  for (const b of bingos ?? []) {
    const t = Date.parse(b.completed_at);
    const prev = firstBingoByPlayer.get(b.player_id);
    if (prev === undefined || t < prev) firstBingoByPlayer.set(b.player_id, t);
  }

  // Fastest Bingo inputs.
  const timings = eligiblePlayers.flatMap((p) => {
    const cardId = cardIdByPlayer.get(p.id);
    if (!cardId) return [];
    const firstClaim = firstClaimByCard.get(cardId);
    if (firstClaim === undefined) return [];
    return [
      {
        playerId: p.id,
        firstClaimAt: firstClaim,
        firstBingoAt: firstBingoByPlayer.get(p.id) ?? null,
      },
    ];
  });
  const fastest = fastestBingoWinners(timings);

  // Unluckiest inputs: claims-to-bingo for bingoers, total claim count for non-bingoers.
  const claimsToBingo = eligiblePlayers.flatMap((p) => {
    const cardId = cardIdByPlayer.get(p.id);
    if (!cardId) return [];
    const firstBingoAt = firstBingoByPlayer.get(p.id);
    if (firstBingoAt === undefined) {
      return [
        { playerId: p.id, claimsToBingo: totalClaimsByCard.get(cardId) ?? 0 },
      ];
    }
    let n = 0;
    for (const c of claims ?? []) {
      if (c.card_id !== cardId) continue;
      if (Date.parse(c.claimed_at) <= firstBingoAt) n++;
    }
    return [{ playerId: p.id, claimsToBingo: n }];
  });
  const unluckiest = unluckiestWinners(claimsToBingo);

  // Insert awards (idempotent — re-running End Game produces the same set).
  // prize_awards has no unique index for the end-of-game prizes (to allow
  // ties), so we clear any prior rows before writing the fresh slate.
  await supabase
    .from("prize_awards")
    .delete()
    .eq("event_id", event.id)
    .in("prize", ["fastest_bingo", "unluckiest"]);

  const prizeRows = [
    ...fastest.map((w) => ({
      event_id: event.id,
      prize: "fastest_bingo" as const,
      player_id: w.playerId,
      detail: { duration_ms: w.durationMs },
    })),
    ...unluckiest.map((w) => ({
      event_id: event.id,
      prize: "unluckiest" as const,
      player_id: w.playerId,
      detail: { claims_to_bingo: w.claimsToBingo },
    })),
  ];
  if (prizeRows.length > 0) {
    const { error: prizeErr } = await supabase
      .from("prize_awards")
      .insert(prizeRows);
    if (prizeErr) throw new Error(prizeErr.message);
  }

  revalidatePath(`/facilitate/${event.code}`);
  revalidatePath(`/admin/${event.code}`);
}

// ─── roster ─────────────────────────────────────────────────────────────────

export async function uploadRoster(
  eventCode: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error("Roster is locked after Open Survey.");
  }

  const raw = formData.get("csv");
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Paste at least one row.");
  }

  const rows = parseCsv(raw);
  if (rows.length === 0) throw new Error("No rows parsed from CSV.");

  const header = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader =
    header[0] === "display_name" ||
    header[0] === "name" ||
    header[0] === "display name";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const players = dataRows.map((cols, idx) => {
    const display_name = cols[0]?.trim();
    if (!display_name) {
      throw new Error(`Row ${idx + 1 + (hasHeader ? 1 : 0)} missing a name.`);
    }
    const contact_handle = cols[1]?.trim() || null;
    return {
      event_id: event.id,
      display_name,
      contact_handle,
      access_code: generate96BitToken(),
      qr_nonce: generate96BitToken(),
    };
  });

  const del = await supabase.from("players").delete().eq("event_id", event.id);
  if (del.error) throw new Error(del.error.message);

  const ins = await supabase.from("players").insert(players);
  if (ins.error) throw new Error(ins.error.message);

  revalidatePath(`/admin/${event.code}`);
}

export async function addPlayers(
  eventCode: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft" && event.state !== "survey_open") {
    throw new Error("Cannot add players after the survey closes.");
  }

  const raw = formData.get("csv");
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Paste at least one row.");
  }

  const rows = parseCsv(raw);
  if (rows.length === 0) throw new Error("No rows parsed from CSV.");

  const header = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader =
    header[0] === "display_name" ||
    header[0] === "name" ||
    header[0] === "display name";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const players = dataRows.map((cols, idx) => {
    const display_name = cols[0]?.trim();
    if (!display_name) {
      throw new Error(`Row ${idx + 1 + (hasHeader ? 1 : 0)} missing a name.`);
    }
    const contact_handle = cols[1]?.trim() || null;
    return {
      event_id: event.id,
      display_name,
      contact_handle,
      access_code: generate96BitToken(),
      qr_nonce: generate96BitToken(),
    };
  });

  const ins = await supabase.from("players").insert(players);
  if (ins.error) throw new Error(ins.error.message);

  revalidatePath(`/admin/${event.code}`);
}

export async function clearRoster(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error("Roster is locked after Open Survey.");
  }
  const del = await supabase.from("players").delete().eq("event_id", event.id);
  if (del.error) throw new Error(del.error.message);
  revalidatePath(`/admin/${event.code}`);
}

// ─── questions ──────────────────────────────────────────────────────────────

async function nextQuestionPosition(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("survey_questions")
    .select("position")
    .eq("event_id", eventId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const top = data?.[0]?.position;
  return typeof top === "number" ? top + 1 : 0;
}

export async function forkStarterQuestions(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error("Questions can only be forked in draft state.");
  }

  const { count, error: cntErr } = await supabase
    .from("survey_questions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id);
  if (cntErr) throw new Error(cntErr.message);
  if ((count ?? 0) > 0) {
    throw new Error("Questions already exist — clear them before forking.");
  }

  // Insert questions in one batch to keep ordering stable.
  const questionRows = STARTER_QUESTIONS.map((q, i) => ({
    event_id: event.id,
    prompt: q.prompt,
    type: q.type,
    options: q.options ?? null,
    position: i,
  }));
  const { data: inserted, error: qErr } = await supabase
    .from("survey_questions")
    .insert(questionRows)
    .select("id, type, prompt, options, position");
  if (qErr || !inserted) throw new Error(qErr?.message ?? "question insert failed");

  // Build trait templates using the starter template's per-option square data.
  const traitRows: {
    event_id: string;
    question_id: string;
    kind: "cohort" | "discovery";
    match_rule: MatchRule | null;
    square_text: string;
    conversation_prompt: string | null;
    enabled: boolean;
  }[] = [];
  for (const row of inserted) {
    const starter = STARTER_QUESTIONS[row.position];
    if (!starter) continue;
    if (starter.type === "text") {
      const sq = starter.squares[0];
      traitRows.push({
        event_id: event.id,
        question_id: row.id,
        kind: "discovery",
        match_rule: null,
        square_text: (sq?.squareText ?? `Learn: ${starter.prompt}`).slice(0, 36),
        conversation_prompt: null,
        enabled: sq?.enabled ?? true,
      });
    } else {
      const op: MatchRule["op"] = starter.type === "multi" ? "includes" : "eq";
      for (const sq of starter.squares) {
        traitRows.push({
          event_id: event.id,
          question_id: row.id,
          kind: "cohort",
          match_rule: { op, value: sq.answer },
          square_text: sq.squareText.slice(0, 36),
          conversation_prompt: sq.prompt || null,
          enabled: sq.enabled,
        });
      }
    }
  }

  if (traitRows.length > 0) {
    const { error: tErr } = await supabase
      .from("trait_templates")
      .insert(traitRows);
    if (tErr) throw new Error(tErr.message);
  }

  revalidatePath(`/admin/${event.code}`);
}

const addQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(200),
  type: z.enum(["single", "multi", "binary", "text", "numeric_bucket"]),
  options: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
});

export async function addQuestion(
  eventCode: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft" && event.state !== "survey_open") {
    throw new Error("Questions are frozen after Close Survey.");
  }

  const rawOptions = formData.get("options");
  const optionsArr =
    typeof rawOptions === "string" && rawOptions.trim()
      ? rawOptions
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : undefined;

  const parsed = addQuestionSchema.parse({
    prompt: formData.get("prompt"),
    type: formData.get("type"),
    options: optionsArr,
  });

  const needsOptions =
    parsed.type === "single" ||
    parsed.type === "multi" ||
    parsed.type === "binary" ||
    parsed.type === "numeric_bucket";
  if (needsOptions) {
    if (!parsed.options || parsed.options.length < 2) {
      throw new Error(`${parsed.type} questions need at least 2 options.`);
    }
    if (parsed.type === "binary" && parsed.options.length !== 2) {
      throw new Error("Binary questions need exactly 2 options.");
    }
  } else {
    if (parsed.options && parsed.options.length > 0) {
      throw new Error("Text questions can't have options.");
    }
  }

  const position = await nextQuestionPosition(supabase, event.id);
  const { data: q, error: qErr } = await supabase
    .from("survey_questions")
    .insert({
      event_id: event.id,
      prompt: parsed.prompt,
      type: parsed.type,
      options: needsOptions ? parsed.options : null,
      position,
    })
    .select("id")
    .single();
  if (qErr || !q) throw new Error(qErr?.message ?? "insert failed");

  const seeds = seedsForQuestion(
    parsed.type,
    parsed.prompt,
    parsed.options ?? null,
  );
  if (seeds.length > 0) {
    const { error: tErr } = await supabase.from("trait_templates").insert(
      seeds.map((s) => ({
        event_id: event.id,
        question_id: q.id,
        kind: s.kind,
        match_rule: s.match_rule,
        square_text: s.square_text,
        conversation_prompt: s.conversation_prompt,
      })),
    );
    if (tErr) throw new Error(tErr.message);
  }

  revalidatePath(`/admin/${event.code}`);
}

export async function deleteQuestion(
  eventCode: string,
  questionId: string,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error("Questions can only be deleted in draft.");
  }
  const id = uuidSchema.parse(questionId);

  const { error } = await supabase
    .from("survey_questions")
    .delete()
    .eq("id", id)
    .eq("event_id", event.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}`);
}

export async function moveQuestion(
  eventCode: string,
  questionId: string,
  direction: "up" | "down",
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error("Reordering is locked after Open Survey.");
  }
  const id = uuidSchema.parse(questionId);

  const { data: all, error: listErr } = await supabase
    .from("survey_questions")
    .select("id, position")
    .eq("event_id", event.id)
    .order("position");
  if (listErr || !all) throw new Error(listErr?.message ?? "list failed");

  const idx = all.findIndex((q) => q.id === id);
  if (idx < 0) throw new Error("Question not found.");
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];

  // Temp-position trick to avoid tripping the (event_id, position) unique.
  const temp = -1 - idx;
  const step1 = await supabase
    .from("survey_questions")
    .update({ position: temp })
    .eq("id", a.id);
  if (step1.error) throw new Error(step1.error.message);
  const step2 = await supabase
    .from("survey_questions")
    .update({ position: a.position })
    .eq("id", b.id);
  if (step2.error) throw new Error(step2.error.message);
  const step3 = await supabase
    .from("survey_questions")
    .update({ position: b.position })
    .eq("id", a.id);
  if (step3.error) throw new Error(step3.error.message);

  revalidatePath(`/admin/${event.code}`);
}

const updatePromptSchema = z.object({
  prompt: z.string().trim().min(3).max(200),
});

export async function updateQuestionPrompt(
  eventCode: string,
  questionId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft" && event.state !== "survey_open") {
    throw new Error("Prompts are frozen after Close Survey.");
  }
  const id = uuidSchema.parse(questionId);
  const { prompt } = updatePromptSchema.parse({
    prompt: formData.get("prompt"),
  });

  const { error } = await supabase
    .from("survey_questions")
    .update({ prompt })
    .eq("id", id)
    .eq("event_id", event.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}`);
}

const addOptionSchema = z.object({
  option: z.string().trim().min(1).max(60),
});

// Non-destructive: only adds new options. Emits a new cohort trait template
// for that option so survey respondents can still pick it and card-gen can
// match on it.
export async function addQuestionOption(
  eventCode: string,
  questionId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft" && event.state !== "survey_open") {
    throw new Error("Options are frozen after Close Survey.");
  }
  const id = uuidSchema.parse(questionId);
  const { option } = addOptionSchema.parse({ option: formData.get("option") });

  const { data: q, error: qErr } = await supabase
    .from("survey_questions")
    .select("type, options, prompt")
    .eq("id", id)
    .eq("event_id", event.id)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!q) throw new Error("Question not found.");
  if (q.type === "text") {
    throw new Error("Text questions don't have options.");
  }
  if (q.type === "binary") {
    throw new Error("Binary questions are fixed at 2 options.");
  }

  const existing: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];
  if (existing.includes(option)) {
    throw new Error("Option already exists.");
  }
  const next = [...existing, option];

  const upd = await supabase
    .from("survey_questions")
    .update({ options: next })
    .eq("id", id);
  if (upd.error) throw new Error(upd.error.message);

  const op: MatchRule["op"] = q.type === "multi" ? "includes" : "eq";
  const trait = await supabase.from("trait_templates").insert({
    event_id: event.id,
    question_id: id,
    kind: "cohort" as const,
    match_rule: { op, value: option },
    square_text: option.slice(0, 36),
    conversation_prompt: `Ask about their "${option}" answer to "${q.prompt}".`,
  });
  if (trait.error) throw new Error(trait.error.message);

  revalidatePath(`/admin/${event.code}`);
}

export async function removeQuestionOption(
  eventCode: string,
  questionId: string,
  option: string,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "draft") {
    throw new Error("Removing options is only allowed in draft.");
  }
  const id = uuidSchema.parse(questionId);

  const { data: q, error: qErr } = await supabase
    .from("survey_questions")
    .select("type, options")
    .eq("id", id)
    .eq("event_id", event.id)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!q) throw new Error("Question not found.");
  if (q.type === "text" || q.type === "binary") {
    throw new Error("Can't remove options from this question type.");
  }

  const existing: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];
  const next = existing.filter((o) => o !== option);
  if (next.length === existing.length) {
    throw new Error("Option not found.");
  }
  if (next.length < 2) {
    throw new Error("Need at least 2 options remaining.");
  }

  const upd = await supabase
    .from("survey_questions")
    .update({ options: next })
    .eq("id", id);
  if (upd.error) throw new Error(upd.error.message);

  // Remove the cohort trait template for that option (match_rule.value == option).
  const { data: traits, error: tErr } = await supabase
    .from("trait_templates")
    .select("id, match_rule")
    .eq("question_id", id)
    .eq("kind", "cohort");
  if (tErr) throw new Error(tErr.message);
  const toDelete = (traits ?? [])
    .filter((t) => {
      const rule = t.match_rule as MatchRule | null;
      return rule && rule.value === option;
    })
    .map((t) => t.id);
  if (toDelete.length > 0) {
    const del = await supabase.from("trait_templates").delete().in("id", toDelete);
    if (del.error) throw new Error(del.error.message);
  }

  revalidatePath(`/admin/${event.code}`);
}

// ---------------------------------------------------------------------------
// Seed remaining survey responses (testing aid)
// ---------------------------------------------------------------------------

export async function seedRemainingResponses(
  eventCode: string,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "survey_open") {
    throw new Error("Can only seed responses while the survey is open.");
  }

  // Players who have not yet submitted.
  const { data: allPlayers, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("event_id", event.id)
    .is("survey_submitted_at", null);
  if (pErr) throw new Error(pErr.message);
  const unseeded = allPlayers ?? [];
  if (unseeded.length === 0) return;

  // Load questions for this event.
  const { data: questions, error: qErr } = await supabase
    .from("survey_questions")
    .select("id, prompt, type, options")
    .eq("event_id", event.id)
    .order("position");
  if (qErr || !questions) throw new Error(qErr?.message ?? "no questions");

  // Build all response rows.
  type ResponseInsert = {
    player_id: string;
    question_id: string;
    value: string | string[];
  };
  const responses: ResponseInsert[] = [];

  for (const player of unseeded) {
    for (const q of questions) {
      const opts = (q.options as string[] | null) ?? [];
      let value: string | string[];

      if (q.type === "text") {
        const pool = TEXT_ANSWER_POOLS[q.prompt] ?? GENERIC_TEXT_POOL;
        value = pool[Math.floor(Math.random() * pool.length)];
      } else if (q.type === "multi") {
        // Pick 1–3 random options (no duplicates).
        const count = Math.min(
          1 + Math.floor(Math.random() * 3),
          opts.length,
        );
        const shuffled = [...opts].sort(() => Math.random() - 0.5);
        value = shuffled.slice(0, count);
      } else {
        // single, binary, numeric_bucket — pick one.
        value = opts[Math.floor(Math.random() * opts.length)];
      }

      responses.push({
        player_id: player.id,
        question_id: q.id,
        value,
      });
    }
  }

  // Batch-upsert responses (safe if a player partially answered).
  if (responses.length > 0) {
    const { error: rErr } = await supabase
      .from("survey_responses")
      .upsert(responses, { onConflict: "player_id,question_id" });
    if (rErr) throw new Error(rErr.message);
  }

  // Mark all seeded players as submitted.
  const ids = unseeded.map((p) => p.id);
  const { error: uErr } = await supabase
    .from("players")
    .update({ survey_submitted_at: new Date().toISOString() })
    .in("id", ids)
    .is("survey_submitted_at", null);
  if (uErr) throw new Error(uErr.message);

  revalidatePath(`/admin/${event.code}`);
}

