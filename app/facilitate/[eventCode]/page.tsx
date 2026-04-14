import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  endGame,
  setReuseUnlocked,
} from "../../admin/[eventCode]/actions";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";

type Prize =
  | "first_across"
  | "first_down"
  | "first_diagonal"
  | "first_blackout"
  | "fastest_bingo"
  | "unluckiest";

const LIVE_PRIZES: { key: Prize; label: string }[] = [
  { key: "first_across", label: "🥇 First Across" },
  { key: "first_down", label: "🥇 First Down" },
  { key: "first_diagonal", label: "🥇 First Diagonal" },
  { key: "first_blackout", label: "🥇 First Blackout" },
];

const END_PRIZES: { key: Prize; label: string }[] = [
  { key: "fastest_bingo", label: "⏱ Fastest Bingo" },
  { key: "unluckiest", label: "🎯 Unluckiest" },
];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export default async function FacilitateLivePage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const session = await readSession();
  if (!session || session.kind !== "facilitator") redirect("/admin/login");

  const { eventCode } = await params;
  const codeUpper = eventCode.toUpperCase();
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("id, code, name, state, reuse_unlocked, started_at, ended_at")
    .eq("code", codeUpper)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();
  if (!event) notFound();
  if (event.state !== "live" && event.state !== "ended") {
    redirect(`/admin/${event.code}`);
  }

  const [
    { data: players },
    { data: claims },
    { data: bingos },
    { data: awards },
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id, display_name, absent")
      .eq("event_id", event.id),
    supabase
      .from("claims")
      .select(
        "id, position, claimed_at, card_id, via_player_id, trait_template_id, cards(player_id), players:via_player_id(display_name), trait_templates(square_text)",
      )
      .in(
        "card_id",
        (
          await supabase
            .from("cards")
            .select("id")
            .in(
              "player_id",
              (
                await supabase
                  .from("players")
                  .select("id")
                  .eq("event_id", event.id)
              ).data?.map((p) => p.id) ?? [],
            )
        ).data?.map((c) => c.id) ?? ["00000000-0000-0000-0000-000000000000"],
      )
      .order("claimed_at", { ascending: false })
      .limit(20),
    supabase
      .from("bingos")
      .select("id, player_id, line_type, line_index, completed_at")
      .in(
        "player_id",
        (
          await supabase
            .from("players")
            .select("id")
            .eq("event_id", event.id)
        ).data?.map((p) => p.id) ?? [],
      )
      .order("completed_at", { ascending: false }),
    supabase
      .from("prize_awards")
      .select("prize, player_id, awarded_at, detail")
      .eq("event_id", event.id),
  ]);

  const playerById = new Map(
    (players ?? []).map((p) => [p.id, p.display_name]),
  );

  // Claim counts per player — from cards.player_id via the claims we just loaded.
  // The activity-feed query above is limited to 20 rows, so for totals we re-query.
  const { data: allClaims } = await supabase
    .from("claims")
    .select("card_id, cards(player_id)")
    .in(
      "card_id",
      (
        await supabase
          .from("cards")
          .select("id")
          .in(
            "player_id",
            (players ?? []).map((p) => p.id),
          )
      ).data?.map((c) => c.id) ?? ["00000000-0000-0000-0000-000000000000"],
    );

  const claimsPerPlayer = new Map<string, number>();
  for (const c of allClaims ?? []) {
    const card = Array.isArray(c.cards) ? c.cards[0] : c.cards;
    if (!card) continue;
    claimsPerPlayer.set(
      card.player_id,
      (claimsPerPlayer.get(card.player_id) ?? 0) + 1,
    );
  }
  const topClaimers = [...(players ?? [])]
    .filter((p) => !p.absent)
    .map((p) => ({
      id: p.id,
      display_name: p.display_name,
      count: claimsPerPlayer.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const maxClaims = Math.max(1, topClaimers[0]?.count ?? 0);

  const awardByPrize = new Map<Prize, typeof awards>();
  for (const a of awards ?? []) {
    const key = a.prize as Prize;
    const arr = awardByPrize.get(key) ?? [];
    arr.push(a);
    awardByPrize.set(key, arr);
  }

  const totalClaims = allClaims?.length ?? 0;
  const totalBingos = bingos?.length ?? 0;
  const playerCount = (players ?? []).filter((p) => !p.absent).length;
  const isLive = event.state === "live";

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      {isLive ? <AutoRefresh /> : null}

      <nav className="text-sm">
        <a href={`/admin/${event.code}`} className="text-zinc-500 hover:text-zinc-900">
          ← Event dashboard
        </a>
      </nav>

      <header className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-zinc-500">
            {isLive ? "🟢 LIVE" : "🔴 ENDED"} ·{" "}
            {event.started_at ? `started ${fmtTime(event.started_at)}` : "—"}
            {event.ended_at ? ` · ended ${fmtTime(event.ended_at)}` : ""}
          </p>
        </div>
        <div className="font-mono text-sm text-zinc-500">{event.code}</div>
      </header>

      <section className="mt-6 rounded border border-zinc-200 p-4">
        <h2 className="text-lg font-medium">Prize slots</h2>
        <ul className="mt-3 divide-y divide-zinc-200">
          {[...LIVE_PRIZES, ...END_PRIZES].map((p) => {
            const rows = awardByPrize.get(p.key) ?? [];
            return (
              <li
                key={p.key}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="font-medium">{p.label}</span>
                <span className="text-right text-zinc-700">
                  {rows.length === 0 ? (
                    <span className="text-zinc-400">
                      {p.key === "fastest_bingo" || p.key === "unluckiest"
                        ? isLive
                          ? "(end of game)"
                          : "—"
                        : "— waiting —"}
                    </span>
                  ) : (
                    rows.map((r, i) => (
                      <span key={i} className="ml-2">
                        {playerById.get(r.player_id) ?? "?"}
                        {p.key === "fastest_bingo" &&
                        r.detail &&
                        typeof r.detail === "object" &&
                        "duration_ms" in r.detail
                          ? ` · ${fmtDuration(Number((r.detail as { duration_ms: number }).duration_ms))}`
                          : null}
                        {p.key === "unluckiest" &&
                        r.detail &&
                        typeof r.detail === "object" &&
                        "claims_to_bingo" in r.detail
                          ? ` · ${(r.detail as { claims_to_bingo: number }).claims_to_bingo} claims`
                          : null}
                        {["first_across", "first_down", "first_diagonal", "first_blackout"].includes(p.key)
                          ? ` · ${fmtTime(r.awarded_at)}`
                          : null}
                      </span>
                    ))
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {isLive ? (
        <section className="mt-6 rounded border border-zinc-200 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Reuse toggle</h2>
            <span className="text-xs text-zinc-500">
              {event.reuse_unlocked
                ? "ON — duplicates allowed"
                : "OFF — one teammate per card"}
            </span>
          </div>
          <form
            action={setReuseUnlocked.bind(
              null,
              event.code,
              !event.reuse_unlocked,
            )}
            className="mt-3"
          >
            <button
              type="submit"
              className={`rounded px-4 py-2 text-sm text-white ${
                event.reuse_unlocked
                  ? "bg-zinc-600 hover:bg-zinc-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {event.reuse_unlocked ? "Turn reuse OFF" : "Turn reuse ON"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-6 rounded border border-zinc-200 p-4">
        <h2 className="text-lg font-medium">Claims per player (top 10)</h2>
        {topClaimers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No claims yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {topClaimers.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-40 truncate">{p.display_name}</span>
                <span
                  className="h-3 rounded bg-zinc-800"
                  style={{
                    width: `${Math.max(4, (p.count / maxClaims) * 320)}px`,
                  }}
                  aria-hidden
                />
                <span className="font-mono text-xs text-zinc-500">
                  {p.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 p-4">
        <h2 className="text-lg font-medium">Activity feed</h2>
        {(claims ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No claims yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1 text-xs">
            {(claims ?? []).map((c) => {
              const card = Array.isArray(c.cards) ? c.cards[0] : c.cards;
              const scannerName = card
                ? playerById.get(card.player_id) ?? "?"
                : "?";
              const via = Array.isArray(c.players) ? c.players[0] : c.players;
              const tt = Array.isArray(c.trait_templates)
                ? c.trait_templates[0]
                : c.trait_templates;
              const bingoHere = (bingos ?? []).some(
                (b) =>
                  Math.abs(
                    Date.parse(b.completed_at) - Date.parse(c.claimed_at),
                  ) < 1000 && card?.player_id === b.player_id,
              );
              return (
                <li key={c.id} className="flex gap-2">
                  <span className="font-mono text-zinc-400">
                    {fmtTime(c.claimed_at)}
                  </span>
                  <span>
                    <b>{scannerName}</b> claimed &ldquo;
                    {tt?.square_text ?? "?"}&rdquo; via{" "}
                    {via?.display_name ?? "?"}
                    {bingoHere ? " → BINGO!" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-zinc-600">
            {totalClaims} claims · {totalBingos} bingos · {playerCount} players
          </div>
          {isLive ? (
            <form action={endGame.bind(null, event.code)}>
              <button
                type="submit"
                className="rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800"
              >
                End Game ■
              </button>
            </form>
          ) : (
            <span className="text-sm font-medium text-red-700">
              Game ended
            </span>
          )}
        </div>
      </section>
    </main>
  );
}
