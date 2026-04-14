import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FREE_POSITION } from "@/lib/cardGen";
import { PlayerTabs } from "../PlayerTabs";
import { CardGrid, type SquareView } from "./CardGrid";

export const dynamic = "force-dynamic";

export default async function PlayerCardPage() {
  const session = await readSession();
  if (!session || session.kind !== "player") redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name, absent, event_id, events(code, name, state)")
    .eq("id", session.player_id)
    .maybeSingle();
  if (!player) redirect("/p/link-invalid");
  const event = Array.isArray(player.events) ? player.events[0] : player.events;
  if (!event) redirect("/p/link-invalid");
  if (event.state !== "live" && event.state !== "ended") {
    redirect("/p/not-yet");
  }

  if (player.absent) {
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-10 text-center">
        <h1 className="text-xl font-semibold">No card for you</h1>
        <p className="mt-3 text-sm text-zinc-600">
          You were marked absent, so no card was generated. Flag down{" "}
          the facilitator if that was a mistake.
        </p>
        <PlayerTabs active="card" />
      </main>
    );
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("player_id", player.id)
    .maybeSingle();

  if (!card) {
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-10 text-center">
        <h1 className="text-xl font-semibold">Your card isn&apos;t ready</h1>
        <p className="mt-3 text-sm text-zinc-600">
          The facilitator hasn&apos;t started the game yet — hang tight.
        </p>
        <PlayerTabs active="card" />
      </main>
    );
  }

  const { data: rows } = await supabase
    .from("card_squares")
    .select(
      "position, trait_template_id, trait_templates(kind, square_text, conversation_prompt)",
    )
    .eq("card_id", card.id)
    .order("position");

  const squares: SquareView[] = (rows ?? []).map((r) => {
    const tt = Array.isArray(r.trait_templates)
      ? r.trait_templates[0]
      : r.trait_templates;
    if (r.position === FREE_POSITION || !tt) {
      return {
        position: r.position,
        squareText: null,
        conversationPrompt: null,
        kind: "free",
        claimed: true,
      };
    }
    return {
      position: r.position,
      squareText: tt.square_text,
      conversationPrompt: tt.conversation_prompt,
      kind: tt.kind as "cohort" | "discovery",
      claimed: false, // claims pipeline lands in Phase 5
    };
  });

  return (
    <main className="mx-auto max-w-md px-3 pb-20 pt-4">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="text-xs text-zinc-500">{event.name}</p>
          <h1 className="text-base font-semibold">{player.display_name}</h1>
        </div>
        <p className="font-mono text-xs text-zinc-500">
          {event.code} · {event.state}
        </p>
      </header>

      <CardGrid squares={squares} />

      <p className="mt-4 text-center text-[11px] text-zinc-500">
        🔖 cohort · 💬 discovery · ★ free
      </p>

      <PlayerTabs active="card" />
    </main>
  );
}
