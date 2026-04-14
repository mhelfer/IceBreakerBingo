import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Play } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readFacilitatorSession } from "@/lib/session";
import { Banner } from "@/app/components/ui/Banner";
import { buttonClass } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { setPlayerAbsent, startGame } from "../actions";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: string;
  display_name: string;
  absent: boolean;
  survey_submitted_at: string | null;
};

export default async function StartGamePage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const session = await readFacilitatorSession();
  if (!session) redirect("/admin/login");

  const { eventCode } = await params;
  const codeUpper = eventCode.toUpperCase();
  const supabase = getSupabaseAdmin();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, code, name, state")
    .eq("code", codeUpper)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!event) notFound();
  if (event.state !== "curation_locked") {
    redirect(`/admin/${event.code}`);
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, display_name, absent, survey_submitted_at")
    .eq("event_id", event.id)
    .order("display_name");
  const roster = (players ?? []) as PlayerRow[];
  const present = roster.filter((p) => !p.absent);
  const noSurveyPresent = present.filter((p) => !p.survey_submitted_at);

  return (
    <div className="flex flex-col gap-5">
      <Banner tone="info">
        Tap a name to toggle attendance. Absent players are excluded from match
        pools. Players who skipped the survey still get a card, but only satisfy
        cohort squares they already answered for.
      </Banner>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Attendance</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {present.length} of {roster.length} present
              {noSurveyPresent.length > 0
                ? ` · ${noSurveyPresent.length} without a survey`
                : ""}
            </p>
          </div>
        </div>

        <div className="p-4">
          <ul className="flex flex-wrap gap-2">
            {roster.map((p) => {
              const isPresent = !p.absent;
              const noSurvey = !p.survey_submitted_at;
              return (
                <li key={p.id}>
                  <form
                    action={setPlayerAbsent.bind(
                      null,
                      event.code,
                      p.id,
                      !p.absent,
                    )}
                  >
                    <button
                      type="submit"
                      title={
                        noSurvey
                          ? "No survey submission — will play degraded."
                          : undefined
                      }
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        isPresent
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
                          : "border-dashed border-zinc-300 bg-white text-zinc-400 hover:border-zinc-400",
                      ].join(" ")}
                    >
                      {noSurvey ? (
                        <AlertTriangle
                          size={11}
                          className={
                            isPresent ? "text-amber-600" : "text-zinc-300"
                          }
                        />
                      ) : null}
                      <span className={isPresent ? "" : "line-through"}>
                        {p.display_name}
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <Card className="bg-zinc-50/80">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="max-w-md text-sm text-zinc-600">
            Starting the game generates every present player&rsquo;s 5×5 card
            from the curated trait pool. This can&rsquo;t be undone from the UI.
          </div>
          <form action={startGame.bind(null, event.code)} className="flex items-center gap-3">
            {present.length < 4 ? (
              <span className="text-xs text-zinc-500">
                Need at least 4 present players.
              </span>
            ) : null}
            <button
              type="submit"
              disabled={present.length < 4}
              className={buttonClass("primary", "md")}
            >
              <Play size={14} /> Start game
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
