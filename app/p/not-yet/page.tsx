import { Clock } from "lucide-react";
import { readPlayerSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PlayerHero } from "../PlayerHero";

export const dynamic = "force-dynamic";

export default async function NotYetPage() {
  const session = await readPlayerSession();
  let name: string | null = null;
  let eventName: string | null = null;
  let startsAt: string | null = null;
  if (session) {
    const supabase = getSupabaseAdmin();
    const { data: p } = await supabase
      .from("players")
      .select("display_name, events(name, starts_at)")
      .eq("id", session.player_id)
      .maybeSingle();
    if (p) {
      name = p.display_name;
      const ev = Array.isArray(p.events) ? p.events[0] : p.events;
      eventName = ev?.name ?? null;
      startsAt = ev?.starts_at ?? null;
    }
  }

  return (
    <PlayerHero
      icon={<Clock size={20} />}
      tone="muted"
      eyebrow={eventName ?? "IceBreaker Bingo"}
      title={name ? `Hi, ${name}` : "Not quite yet"}
      body={
        <>
          {startsAt ? (
            <p>
              The game starts{" "}
              <time dateTime={startsAt} className="font-medium text-zinc-800">
                {new Date(startsAt).toLocaleString(undefined, {
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
          <p className="mt-2">Re-open this link when things kick off.</p>
        </>
      }
      footer="This link is personal — please don't share it."
    />
  );
}
