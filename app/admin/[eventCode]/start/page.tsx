import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSession } from "@/lib/session";
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
  const session = await readSession();
  if (!session || session.kind !== "facilitator") redirect("/admin/login");

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="text-sm">
        <a
          href={`/admin/${event.code}`}
          className="text-zinc-500 hover:text-zinc-900"
        >
          ← Back to event
        </a>
      </nav>

      <header className="mt-4 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{event.name} — Start Game</h1>
        <div className="font-mono text-sm text-zinc-500">
          {event.code} · {event.state}
        </div>
      </header>

      <p className="mt-4 text-sm text-zinc-600">
        Mark absentees. Cards will generate when you hit Start Game, excluding
        absent players from match pools. Players who never submitted the survey
        (⚠) still get a card but satisfy only the cohort squares they already
        answered.
      </p>

      <section className="mt-6 rounded border border-zinc-200 bg-white">
        <div className="flex items-baseline justify-between px-4 py-3">
          <h2 className="font-medium">
            Roster{" "}
            <span className="text-sm text-zinc-500">
              ({present.length}/{roster.length} present)
            </span>
          </h2>
        </div>
        <ul className="divide-y divide-zinc-200">
          {roster.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <span className={p.absent ? "text-zinc-400 line-through" : ""}>
                {p.display_name}
                {!p.survey_submitted_at ? (
                  <span
                    className="ml-2 text-xs text-amber-600"
                    title="No survey submission — will play degraded."
                  >
                    ⚠ no survey
                  </span>
                ) : null}
              </span>
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
                  className={`rounded px-2 py-1 text-xs ${
                    p.absent
                      ? "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                  }`}
                >
                  {p.absent ? "absent" : "present"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-600">
          Starting the game generates every present player's 5×5 card from the
          curated trait pool. This can't be undone from the UI.
        </p>
        <form action={startGame.bind(null, event.code)} className="mt-3">
          <button
            type="submit"
            disabled={present.length < 4}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-800"
          >
            Start Game ▶
          </button>
          {present.length < 4 ? (
            <span className="ml-3 text-xs text-zinc-500">
              Need at least 4 present players.
            </span>
          ) : null}
        </form>
      </section>
    </main>
  );
}
