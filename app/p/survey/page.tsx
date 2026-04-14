import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SurveyForm, type SurveyQuestion } from "./SurveyForm";

export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  const session = await readSession();
  if (!session || session.kind !== "player") redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, state")
    .eq("id", session.event_id)
    .maybeSingle();
  if (!event) redirect("/p/link-invalid");
  if (event.state !== "survey_open") redirect("/p/not-yet");

  const { data: player } = await supabase
    .from("players")
    .select("display_name, survey_submitted_at")
    .eq("id", session.player_id)
    .maybeSingle();
  if (!player) redirect("/p/link-invalid");
  if (player.survey_submitted_at) redirect("/p/survey-done");

  const [{ data: qs }, { data: rs }] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id, prompt, type, options, position")
      .eq("event_id", event.id)
      .order("position"),
    supabase
      .from("survey_responses")
      .select("question_id, value")
      .eq("player_id", session.player_id),
  ]);

  const questions = (qs ?? []) as SurveyQuestion[];
  const answers = new Map<string, unknown>(
    (rs ?? []).map((r) => [r.question_id, r.value]),
  );
  const initial = questions.map((q) => ({
    id: q.id,
    value: answers.get(q.id) ?? null,
  }));

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4">
        <p className="text-xs text-zinc-500">{event.name}</p>
        <h1 className="text-xl font-semibold">Hi, {player.display_name} 👋</h1>
        <p className="mt-2 text-xs text-zinc-500">
          🔒 This is your private survey. Nobody else sees your answers.
        </p>
      </header>
      <SurveyForm questions={questions} initial={initial} />
    </main>
  );
}
