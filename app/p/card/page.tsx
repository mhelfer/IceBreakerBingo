import { redirect } from "next/navigation";
import { readPlayerSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FREE_POSITION } from "@/lib/cardGen";
import { PlayerTabs } from "../PlayerTabs";
import { CardGrid, type SquareView } from "./CardGrid";
import { Onboarding } from "./Onboarding";

export const dynamic = "force-dynamic";

export default async function PlayerCardPage() {
  const session = await readPlayerSession();
  if (!session) redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name, absent, event_id, events(code, name, state)")
    .eq("id", session.player_id)
    .maybeSingle();
  if (!player) redirect("/p/link-invalid");
  const event = Array.isArray(player.events) ? player.events[0] : player.events;
  if (!event) redirect("/p/link-invalid");
  if (
    event.state !== "live" &&
    event.state !== "paused" &&
    event.state !== "ended"
  ) {
    redirect("/p/not-yet");
  }

  if (player.absent) {
    return (
      <>
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 pb-24 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">No card for you</h1>
          <p className="mt-3 text-sm text-zinc-600">
            You were marked absent, so no card was generated. Flag down the
            facilitator if that was a mistake.
          </p>
        </main>
        <PlayerTabs active="card" />
      </>
    );
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("player_id", player.id)
    .maybeSingle();

  if (!card) {
    return (
      <>
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 pb-24 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            Your card isn&rsquo;t ready
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            The facilitator hasn&rsquo;t started the game yet — hang tight.
          </p>
        </main>
        <PlayerTabs active="card" />
      </>
    );
  }

  const [{ data: rows }, { data: claims }] = await Promise.all([
    supabase
      .from("card_squares")
      .select(
        "position, trait_template_id, trait_templates(kind, square_text, conversation_prompt)",
      )
      .eq("card_id", card.id)
      .order("position"),
    supabase
      .from("claims")
      .select("position, via_player_id, conversation_prompt, players(display_name)")
      .eq("card_id", card.id),
  ]);

  const claimByPosition = new Map(
    (claims ?? []).map((c) => {
      const via = Array.isArray(c.players) ? c.players[0] : c.players;
      return [
        c.position,
        {
          viaDisplayName: via?.display_name ?? "Teammate",
          conversationPrompt: c.conversation_prompt as string | null,
        },
      ];
    }),
  );

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
        viaDisplayName: null,
      };
    }
    const claim = claimByPosition.get(r.position);
    return {
      position: r.position,
      squareText: tt.square_text,
      conversationPrompt: claim?.conversationPrompt ?? tt.conversation_prompt,
      kind: tt.kind as "cohort" | "discovery",
      claimed: !!claim,
      viaDisplayName: claim?.viaDisplayName ?? null,
    };
  });

  const claimedCount = squares.filter(
    (s) => s.claimed && s.kind !== "free",
  ).length;
  const totalClaimable = squares.filter((s) => s.kind !== "free").length;

  return (
    <main className="mx-auto max-w-md px-3 pb-28 pt-4">
      <header className="mb-3 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {event.name}
          </p>
          <h1 className="text-base font-semibold text-zinc-900">
            {player.display_name}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold text-zinc-900">
            {claimedCount}
            <span className="text-zinc-400"> / {totalClaimable}</span>
          </p>
          <p className="text-[10px] text-zinc-500">claimed</p>
        </div>
      </header>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{
            width: `${
              totalClaimable === 0 ? 0 : (claimedCount / totalClaimable) * 100
            }%`,
          }}
          aria-hidden
        />
      </div>

      {event.state === "paused" ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Game paused. Scanning is disabled until your facilitator resumes.
        </div>
      ) : null}

      <CardGrid squares={squares} />
      {event.state === "live" ? <Onboarding eventId={player.event_id} /> : null}

      <PlayerTabs active="card" />
    </main>
  );
}
