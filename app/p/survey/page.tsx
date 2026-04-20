import { redirect } from "next/navigation";
import { readPlayerSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SurveyForm, type SurveyQuestion } from "./SurveyForm";
import { PlayerAutoRefresh } from "../PlayerAutoRefresh";

export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  const session = await readPlayerSession();
  if (!session) redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, state")
    .eq("id", session.event_id)
    .maybeSingle();
  if (!event) redirect("/p/link-invalid");

  // Game is live or ended — go straight to the card
  if (event.state === "live" || event.state === "ended") redirect("/p/card");
  // Draft — survey isn't open yet
  if (event.state === "draft") redirect("/p/not-yet");

  const readOnly =
    event.state === "survey_closed" || event.state === "curation_locked";

  const { data: player } = await supabase
    .from("players")
    .select("display_name, survey_submitted_at")
    .eq("id", session.player_id)
    .maybeSingle();
  if (!player) redirect("/p/link-invalid");

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
    <main className="mx-auto max-w-md px-4 pt-5">
      <header className="mb-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {event.name}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900">
          Hi, {player.display_name}
        </h1>
      </header>
      <SurveyForm
        questions={questions}
        initial={initial}
        readOnly={readOnly}
        initiallySubmitted={!!player.survey_submitted_at}
      />
      <PlayerAutoRefresh />
    </main>
  );
}
