import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PlayerHero } from "../../PlayerHero";

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

  return (
    <PlayerHero
      icon={<Clock size={20} />}
      tone="muted"
      eyebrow={event.name}
      title={`Hi, ${player.display_name}`}
      body={
        <>
          {event.starts_at ? (
            <p>
              The game starts{" "}
              <time
                dateTime={event.starts_at}
                className="font-medium text-zinc-800"
              >
                {new Date(event.starts_at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
              .
            </p>
          ) : (
            <p>The facilitator hasn&rsquo;t started the game yet.</p>
          )}
          <p className="mt-2">
            Reload this page when the game starts to grab your bingo card.
          </p>
        </>
      }
      footer="This link is personal — please don't share it."
    />
  );
}
