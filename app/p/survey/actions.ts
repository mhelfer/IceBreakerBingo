"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePlayer } from "@/lib/session";

const uuidSchema = z.string().uuid();

async function loadSurveyContext() {
  const session = await requirePlayer();
  const supabase = getSupabaseAdmin();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, state")
    .eq("id", session.event_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) throw new Error("EVENT_NOT_FOUND");
  if (event.state !== "survey_open") {
    throw new Error("Survey is not open.");
  }
  return { supabase, session, event };
}

// Accepts string | string[] | null. Empty strings / empty arrays are deletes.
export async function upsertAnswer(formData: FormData): Promise<void> {
  const { supabase, session } = await loadSurveyContext();

  const question_id = uuidSchema.parse(formData.get("question_id"));

  // Load the authoritative question type and options from the DB — never
  // trust the client-supplied type for validation decisions.
  const { data: q, error: qErr } = await supabase
    .from("survey_questions")
    .select("id, event_id, type, options")
    .eq("id", question_id)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!q || q.event_id !== session.event_id) {
    throw new Error("Question not found.");
  }

  const type = q.type as "single" | "multi" | "binary" | "text" | "numeric_bucket";

  let value: unknown;
  if (type === "multi") {
    const all = formData.getAll("value").map((v) => String(v));
    value = all.filter((v) => v.length > 0);
    if ((value as string[]).length === 0) {
      await deleteAnswer(supabase, session.player_id, question_id);
      return;
    }
  } else {
    const raw = formData.get("value");
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s === "") {
      await deleteAnswer(supabase, session.player_id, question_id);
      return;
    }
    value = s;
  }

  // Validate answer against the question's allowed options.
  if (type !== "text" && Array.isArray(q.options)) {
    const allowed = q.options as string[];
    if (type === "multi") {
      const vals = value as string[];
      if (!vals.every((v) => allowed.includes(v))) {
        throw new Error("Invalid option selected.");
      }
    } else {
      if (!allowed.includes(value as string)) {
        throw new Error("Invalid option selected.");
      }
    }
  }

  const { error } = await supabase.from("survey_responses").upsert(
    {
      player_id: session.player_id,
      question_id,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,question_id" },
  );
  if (error) throw new Error(error.message);

  // No revalidatePath here — the client tracks answer state optimistically.
  // Revalidating mid-typing causes a server re-render that races with
  // in-flight keystrokes, dropping letters on mobile.
}

async function deleteAnswer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  player_id: string,
  question_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("survey_responses")
    .delete()
    .eq("player_id", player_id)
    .eq("question_id", question_id);
  if (error) throw new Error(error.message);
}

export async function submitSurvey(): Promise<
  { ok: true } | { ok: false; missing: string[] }
> {
  const { supabase, session } = await loadSurveyContext();

  // Idempotent: if already submitted, return ok immediately.
  const { data: player } = await supabase
    .from("players")
    .select("survey_submitted_at")
    .eq("id", session.player_id)
    .maybeSingle();
  if (player?.survey_submitted_at) return { ok: true };

  const [{ data: qs, error: qErr }, { data: rs, error: rErr }] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id, prompt, position")
      .eq("event_id", session.event_id)
      .order("position"),
    supabase
      .from("survey_responses")
      .select("question_id")
      .eq("player_id", session.player_id),
  ]);
  if (qErr) throw new Error(qErr.message);
  if (rErr) throw new Error(rErr.message);

  const answered = new Set((rs ?? []).map((r) => r.question_id));
  const missing = (qs ?? [])
    .filter((q) => !answered.has(q.id))
    .map((q) => q.prompt);

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const { error } = await supabase
    .from("players")
    .update({ survey_submitted_at: new Date().toISOString() })
    .eq("id", session.player_id);
  if (error) throw new Error(error.message);

  revalidatePath("/p/survey");
  return { ok: true };
}
