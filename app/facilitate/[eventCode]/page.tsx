import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrigin } from "@/lib/origin";
import {
  Award,
  ChevronLeft,
  CircleSlash,
  Clock,
  Flame,
  Medal,
  Radio,
  Shuffle,
  Square,
  Target,
  Trophy,
} from "lucide-react";
import type { ComponentType } from "react";
import { readFacilitatorSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buttonClass } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { CopyButton } from "@/app/components/ui/CopyButton";
import {
  endGame,
  setReuseUnlocked,
  setShowAllMatches,
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

const PRIZE_META: Record<
  Prize,
  { label: string; icon: ComponentType<{ size?: number; className?: string }>; group: "live" | "end" }
> = {
  first_across: { label: "First across", icon: Medal, group: "live" },
  first_down: { label: "First down", icon: Medal, group: "live" },
  first_diagonal: { label: "First diagonal", icon: Medal, group: "live" },
  first_blackout: { label: "First blackout", icon: Trophy, group: "live" },
  fastest_bingo: { label: "Fastest bingo", icon: Flame, group: "end" },
  unluckiest: { label: "Unluckiest", icon: Target, group: "end" },
};

const PRIZE_ORDER: Prize[] = [
  "first_across",
  "first_down",
  "first_diagonal",
  "first_blackout",
  "fastest_bingo",
  "unluckiest",
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
  const session = await readFacilitatorSession();
  if (!session) redirect("/admin/login");

  const { eventCode } = await params;
  const codeUpper = eventCode.toUpperCase();
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("id, code, name, state, reuse_unlocked, show_all_matches, started_at, ended_at")
    .eq("code", codeUpper)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();
  if (!event) notFound();
  if (event.state !== "live" && event.state !== "ended") {
    redirect(`/admin/${event.code}`);
  }

  const origin = await getOrigin();

  const [{ data: players }, { data: awards }] = await Promise.all([
    supabase
      .from("players")
      .select("id, display_name, absent, access_code")
      .eq("event_id", event.id),
    supabase
      .from("prize_awards")
      .select("prize, player_id, awarded_at, detail")
      .eq("event_id", event.id),
  ]);

  const playerIds = (players ?? []).map((p) => p.id);
  const { data: cardRows } = await supabase
    .from("cards")
    .select("id, player_id")
    .in("player_id", playerIds.length ? playerIds : ["00000000-0000-0000-0000-000000000000"]);
  const cardIds = (cardRows ?? []).map((c) => c.id);

  const [{ data: claims }, { data: allClaims }, { data: bingos }] = await Promise.all([
    supabase
      .from("claims")
      .select(
        "id, position, claimed_at, card_id, via_player_id, trait_template_id, cards(player_id), players:via_player_id(display_name), trait_templates(square_text)",
      )
      .in(
        "card_id",
        cardIds.length ? cardIds : ["00000000-0000-0000-0000-000000000000"],
      )
      .order("claimed_at", { ascending: false })
      .limit(20),
    supabase
      .from("claims")
      .select("card_id, cards(player_id)")
      .in(
        "card_id",
        cardIds.length ? cardIds : ["00000000-0000-0000-0000-000000000000"],
      ),
    supabase
      .from("bingos")
      .select("id, player_id, line_type, line_index, completed_at")
      .in(
        "player_id",
        playerIds.length ? playerIds : ["00000000-0000-0000-0000-000000000000"],
      )
      .order("completed_at", { ascending: false }),
  ]);

  const playerById = new Map(
    (players ?? []).map((p) => [p.id, p.display_name]),
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
    <div className="min-h-screen bg-zinc-50/40">
      {isLive ? <AutoRefresh /> : null}

      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <Link
            href={`/admin/${event.code}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ChevronLeft size={14} /> Event dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                  {event.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
                  {event.code}
                </span>
                <LiveStatusPill isLive={isLive} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {event.started_at
                  ? `Started ${fmtTime(event.started_at)}`
                  : "Not yet started"}
                {event.ended_at ? ` · Ended ${fmtTime(event.ended_at)}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">
                {totalClaims} claims · {totalBingos} bingos · {playerCount} players
              </span>
              {isLive ? (
                <form action={endGame.bind(null, event.code)}>
                  <button
                    type="submit"
                    className={buttonClass("danger", "md")}
                    title="Ends the game — cards freeze and end-of-game prizes are awarded."
                  >
                    <Square size={12} /> End game
                  </button>
                </form>
              ) : (
                <form action={endGame.bind(null, event.code)}>
                  <button
                    type="submit"
                    className={buttonClass("secondary", "md")}
                    title="Recomputes end-of-game prizes (fastest bingo, unluckiest)."
                  >
                    Recompute prizes
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Prize slots
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRIZE_ORDER.map((key) => {
              const meta = PRIZE_META[key];
              const Icon = meta.icon;
              const rows = awardByPrize.get(key) ?? [];
              const awarded = rows.length > 0;
              return (
                <li key={key}>
                  <Card className="h-full p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "inline-flex h-8 w-8 items-center justify-center rounded-md",
                            awarded
                              ? "bg-amber-100 text-amber-700"
                              : "bg-zinc-100 text-zinc-400",
                          ].join(" ")}
                        >
                          <Icon size={16} />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {meta.label}
                          </h3>
                          <p className="text-[11px] text-zinc-500">
                            {meta.group === "end"
                              ? "Awarded at end of game"
                              : "Awarded during play"}
                          </p>
                        </div>
                      </div>
                      {awarded ? (
                        <Award size={14} className="text-amber-600" />
                      ) : null}
                    </div>

                    <div className="mt-3 text-sm">
                      {rows.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                          <CircleSlash size={12} />
                          {meta.group === "end"
                            ? isLive
                              ? "Awarded at end"
                              : "Not awarded"
                            : "Waiting…"}
                        </span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {rows.map((r, i) => (
                            <li key={i} className="text-zinc-800">
                              <span className="font-medium">
                                {playerById.get(r.player_id) ?? "?"}
                              </span>
                              {key === "fastest_bingo" &&
                              r.detail &&
                              typeof r.detail === "object" &&
                              "duration_ms" in r.detail ? (
                                <span className="ml-2 text-xs text-zinc-500">
                                  {fmtDuration(
                                    Number(
                                      (r.detail as { duration_ms: number })
                                        .duration_ms,
                                    ),
                                  )}
                                </span>
                              ) : null}
                              {key === "unluckiest" &&
                              r.detail &&
                              typeof r.detail === "object" &&
                              "claims_to_bingo" in r.detail ? (
                                <span className="ml-2 text-xs text-zinc-500">
                                  {
                                    (r.detail as { claims_to_bingo: number })
                                      .claims_to_bingo
                                  }{" "}
                                  claims
                                </span>
                              ) : null}
                              {meta.group === "live" ? (
                                <span className="ml-2 font-mono text-xs text-zinc-400">
                                  {fmtTime(r.awarded_at)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        {isLive ? (
          <>
            <ReuseToggleCard
              eventCode={event.code}
              reuseUnlocked={event.reuse_unlocked}
            />
            <ShowAllMatchesToggle
              eventCode={event.code}
              showAllMatches={event.show_all_matches}
            />
          </>
        ) : null}

        <PlayerLinksSection
          players={players ?? []}
          eventCode={event.code}
          origin={origin}
        />

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Top claimers
              </h2>
              <span className="text-xs text-zinc-400">top 10</span>
            </div>
            {topClaimers.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No claims yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {topClaimers.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="w-32 truncate text-zinc-800">
                      {p.display_name}
                    </span>
                    <span
                      className="h-2 rounded-full bg-zinc-800"
                      style={{
                        width: `${Math.max(4, (p.count / maxClaims) * 240)}px`,
                      }}
                      aria-hidden
                    />
                    <span className="ml-auto font-mono text-xs text-zinc-500">
                      {p.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Activity
            </h2>
            {(claims ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No claims yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
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
                    <li key={c.id} className="flex gap-2 leading-snug">
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-zinc-400">
                        <Clock size={10} />
                        {fmtTime(c.claimed_at)}
                      </span>
                      <span className="text-zinc-700">
                        <span className="font-medium text-zinc-900">
                          {scannerName}
                        </span>{" "}
                        claimed &ldquo;
                        <span className="italic">{tt?.square_text ?? "?"}</span>
                        &rdquo; via{" "}
                        <span className="font-medium text-zinc-900">
                          {via?.display_name ?? "?"}
                        </span>
                        {bingoHere ? (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            <Trophy size={9} /> Bingo
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}

function LiveStatusPill({ isLive }: { isLive: boolean }) {
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
      <Square size={10} /> Ended
    </span>
  );
}

function PlayerLinksSection({
  players,
  eventCode,
  origin,
}: {
  players: { id: string; display_name: string; absent: boolean; access_code: string }[];
  eventCode: string;
  origin: string;
}) {
  const active = players.filter((p) => !p.absent).sort((a, b) => a.display_name.localeCompare(b.display_name));
  if (active.length === 0) return null;

  const allLinks = active
    .map((p) => `${p.display_name} — ${origin}/p/${eventCode}/${p.access_code}`)
    .join("\n");

  return (
    <Card className="p-4">
      <details>
        <summary className="cursor-pointer">
          <div className="inline-flex items-baseline gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Player links
            </h2>
            <span className="text-xs text-zinc-400">{active.length} players</span>
          </div>
        </summary>

        <div className="mt-3 mb-2">
          <CopyButton value={allLinks} label="Copy all links" variant="secondary" size="sm" />
        </div>

        <ul className="flex flex-col gap-1 text-sm">
          {active.map((p) => {
            const url = `${origin}/p/${eventCode}/${p.access_code}`;
            return (
              <li key={p.id} className="flex items-center gap-2">
                <span className="w-36 truncate text-zinc-800">{p.display_name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">{url}</span>
                <CopyButton value={url} label="Copy" iconOnly size="sm" />
              </li>
            );
          })}
        </ul>
      </details>
    </Card>
  );
}

function ReuseToggleCard({
  eventCode,
  reuseUnlocked,
}: {
  eventCode: string;
  reuseUnlocked: boolean;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <Radio size={16} className="mt-0.5 text-zinc-400" />
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Reuse teammates
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {reuseUnlocked
              ? "ON — same teammate can satisfy multiple squares."
              : "OFF — one teammate per card (default)."}
          </p>
        </div>
      </div>
      <form
        action={setReuseUnlocked.bind(null, eventCode, !reuseUnlocked)}
      >
        <button
          type="submit"
          className={buttonClass(reuseUnlocked ? "secondary" : "primary", "sm")}
        >
          {reuseUnlocked ? "Turn off reuse" : "Turn on reuse"}
        </button>
      </form>
    </Card>
  );
}

function ShowAllMatchesToggle({
  eventCode,
  showAllMatches,
}: {
  eventCode: string;
  showAllMatches: boolean;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <Shuffle size={16} className="mt-0.5 text-zinc-400" />
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Match selection
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {showAllMatches
              ? "Show all — players pick which matching square to claim."
              : "Auto-select — a random matching square is chosen for each scan."}
          </p>
        </div>
      </div>
      <form
        action={setShowAllMatches.bind(null, eventCode, !showAllMatches)}
      >
        <button
          type="submit"
          className={buttonClass(showAllMatches ? "secondary" : "primary", "sm")}
        >
          {showAllMatches ? "Use auto-select" : "Show all matches"}
        </button>
      </form>
    </Card>
  );
}

