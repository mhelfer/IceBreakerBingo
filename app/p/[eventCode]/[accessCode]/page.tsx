import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Player entry page. The `proxy.ts` at the project root sets the session
// cookie before this renders, so by the time we're here we already have a
// valid player session. Renders "not yet" inline so the URL doesn't change —
// participants can bookmark the link and reload as the event progresses.
export default async function PlayerEntryPage() {
  const session = await readSession();
  if (!session || session.kind !== "player") {
    redirect("/p/link-invalid");
  }

  const supabase = getSupabaseAdmin();
  const { data: player } = await supabase
    .from("players")
    .select(
      "id, display_name, survey_submitted_at, events(state, name, starts_at)",
    )
    .eq("id", session.player_id)
    .maybeSingle();
  if (!player) redirect("/p/link-invalid");

  const event = Array.isArray(player.events) ? player.events[0] : player.events;
  if (!event) redirect("/p/link-invalid");

  if (event.state === "survey_open") {
    redirect(player.survey_submitted_at ? "/p/survey-done" : "/p/survey");
  }
  if (event.state === "live" || event.state === "ended") {
    redirect("/p/card");
  }

  // draft / survey_closed / curation_locked → render inline so the URL stays.
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl">Hi, {player.display_name} 👋</h1>
      <p className="mt-4 text-sm text-zinc-600">
        {event.name}
        {event.starts_at ? (
          <>
            {" "}starts{" "}
            <time dateTime={event.starts_at}>
              {new Date(event.starts_at).toLocaleString()}
            </time>
          </>
        ) : null}
        .
      </p>
      <p className="mt-6 text-sm text-zinc-600">
        Reload this page when the game starts to grab your bingo card.
      </p>
      <p className="mt-6 text-xs text-zinc-400">
        This link is personal — please don&apos;t share it.
      </p>
    </main>
  );
}
