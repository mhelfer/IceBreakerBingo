import { Pause } from "lucide-react";
import { readPlayerSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PlayerHero } from "../PlayerHero";

export const dynamic = "force-dynamic";

export default async function PausedPage() {
  const session = await readPlayerSession();
  let name: string | null = null;
  let eventName: string | null = null;
  if (session) {
    const supabase = getSupabaseAdmin();
    const { data: p } = await supabase
      .from("players")
      .select("display_name, events(name)")
      .eq("id", session.player_id)
      .maybeSingle();
    if (p) {
      name = p.display_name;
      const ev = Array.isArray(p.events) ? p.events[0] : p.events;
      eventName = ev?.name ?? null;
    }
  }

  return (
    <PlayerHero
      icon={<Pause size={20} />}
      tone="warning"
      eyebrow={eventName ?? "IceBreaker Bingo"}
      title={name ? `Hang tight, ${name}` : "Game paused"}
      body={
        <>
          <p>The facilitator has paused scanning.</p>
          <p className="mt-2">
            Re-open this link when the game picks back up.
          </p>
        </>
      }
      footer="This link is personal — please don't share it."
    />
  );
}
