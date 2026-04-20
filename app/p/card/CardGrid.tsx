"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Check, MessageCircle, Sparkles, X } from "lucide-react";
import { FREE_POSITION } from "@/lib/cardGen";

export type SquareView = {
  position: number;
  squareText: string | null;
  conversationPrompt: string | null;
  kind: "cohort" | "discovery" | "free";
  claimed: boolean;
  viaDisplayName: string | null;
};

type PickerPayload = {
  scanned: { id: string; displayName: string };
  result: "eligible" | "already_used" | "none";
  eligibleTiles: {
    position: number;
    squareText: string;
    kind: "cohort" | "discovery";
  }[];
  postedAt: number;
};

type RevealState = {
  squareText: string;
  conversationPrompt: string;
  kind: "cohort" | "discovery";
  viaDisplayName: string;
  bingo: boolean;
  loading: boolean;
};

type OptimisticClaim = {
  position: number;
  squareText: string;
  kind: "cohort" | "discovery";
  viaDisplayName: string;
};

const PICKER_KEY = "ibb:picker";
const PICKER_TTL_MS = 3 * 60 * 1000;
const TOTAL = 25;

function loadPicker(): PickerPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PICKER_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PickerPayload;
    if (Date.now() - p.postedAt > PICKER_TTL_MS) {
      sessionStorage.removeItem(PICKER_KEY);
      return null;
    }
    return p;
  } catch {
    sessionStorage.removeItem(PICKER_KEY);
    return null;
  }
}

function fireBingoConfetti() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  confetti({
    particleCount: 120,
    spread: 80,
    startVelocity: 45,
    origin: { y: 0.6 },
  });
}

export function CardGrid({ squares }: { squares: SquareView[] }) {
  const router = useRouter();
  const byPosition = new Map(squares.map((s) => [s.position, s]));
  const [active, setActive] = useState<SquareView | null>(null);
  const [picker, setPicker] = useState<PickerPayload | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [optimisticClaim, setOptimisticClaim] = useState<OptimisticClaim | null>(null);
  const [lastClaimedPos, setLastClaimedPos] = useState<number | null>(null);
  const confettiFired = useRef(false);
  const pickerSnapshotRef = useRef<PickerPayload | null>(null);
  const autoClaimFired = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const p = loadPicker();
    setPicker(p);
    // Haptic nudge for multi-square matches
    if (p?.result === "eligible" && p.eligibleTiles.length > 1) {
      navigator.vibrate?.(30);
    }
  }, []);

  const eligiblePositions = new Set(
    picker?.result === "eligible"
      ? picker.eligibleTiles.map((t) => t.position)
      : [],
  );
  const pickerActive = picker?.result === "eligible";

  function dismissPicker() {
    sessionStorage.removeItem(PICKER_KEY);
    setPicker(null);
  }

  async function claimSquare(position: number) {
    if (!picker || picker.result !== "eligible" || submitting) return;

    const tile = picker.eligibleTiles.find((t) => t.position === position);
    if (!tile) return;

    // 1. Optimistic UI — immediately show the square as claimed
    const optimistic: OptimisticClaim = {
      position,
      squareText: tile.squareText,
      kind: tile.kind,
      viaDisplayName: picker.scanned.displayName,
    };
    setOptimisticClaim(optimistic);
    setSubmitting(true);
    setClaimError(null);

    // Snapshot picker for rollback, then dismiss
    pickerSnapshotRef.current = picker;
    dismissPicker();

    // 2. Show reveal modal in loading state
    setReveal({
      squareText: tile.squareText,
      conversationPrompt: "",
      kind: tile.kind,
      viaDisplayName: picker.scanned.displayName,
      bingo: false,
      loading: true,
    });

    // 3. Fire the claim
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          position,
          scannedPlayerId: picker.scanned.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = (await res.json()) as
        | {
            ok: true;
            claimed: true;
            bingo: boolean;
            reveal: {
              squareText: string;
              conversationPrompt: string;
              kind: "cohort" | "discovery";
              viaDisplayName: string;
            };
          }
        | { ok: false; error: string };

      if (!res.ok || !body.ok) {
        // Rollback optimistic state
        setOptimisticClaim(null);
        setReveal(null);
        setClaimError(body.ok === false ? body.error : "claim failed");
        // Restore picker so user can try again
        if (pickerSnapshotRef.current) {
          sessionStorage.setItem(
            PICKER_KEY,
            JSON.stringify(pickerSnapshotRef.current),
          );
          setPicker(pickerSnapshotRef.current);
        }
        setSubmitting(false);
        return;
      }

      // 4. Resolve reveal with real data
      setLastClaimedPos(position);
      setReveal({ ...body.reveal, bingo: body.bingo, loading: false });
      if (body.bingo && !confettiFired.current) {
        confettiFired.current = true;
        fireBingoConfetti();
        navigator.vibrate?.([60, 40, 60, 40, 120]);
      } else {
        navigator.vibrate?.(15);
      }
    } catch {
      // Rollback
      setOptimisticClaim(null);
      setReveal(null);
      setClaimError("network error — try again");
      if (pickerSnapshotRef.current) {
        sessionStorage.setItem(
          PICKER_KEY,
          JSON.stringify(pickerSnapshotRef.current),
        );
        setPicker(pickerSnapshotRef.current);
      }
    } finally {
      pickerSnapshotRef.current = null;
      setSubmitting(false);
    }
  }

  // Auto-claim when exactly 1 eligible tile (single-square mode)
  useEffect(() => {
    if (!picker) return;
    if (picker.result !== "eligible") return;
    if (picker.eligibleTiles.length !== 1) return;
    if (autoClaimFired.current) return;
    if (submitting) return;

    autoClaimFired.current = true;
    void claimSquare(picker.eligibleTiles[0].position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker]);

  function dismissReveal() {
    setReveal(null);
    setOptimisticClaim(null);
    confettiFired.current = false;
    startTransition(() => {
      router.refresh();
    });
  }

  // Should we show the fixed top banner?
  const showFixedBanner = !!picker && !optimisticClaim;

  return (
    <>
      {/* ── Fixed top banner for all picker states ── */}
      {picker && !optimisticClaim ? (
        <div
          role={pickerActive ? "alert" : "status"}
          className="fixed inset-x-0 top-0 z-30 bg-gradient-to-r from-amber-400 to-amber-500 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-lg shadow-amber-500/20 motion-safe:animate-[slideDown_300ms_ease-out]"
        >
          <div className="mx-auto flex max-w-md items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
              <Sparkles size={18} />
            </span>
            <div className="flex-1 text-sm font-medium leading-snug text-white">
              {picker.result === "eligible" ? (
                picker.eligibleTiles.length === 1 ? (
                  <>
                    <b>{picker.scanned.displayName}</b> matched a square
                    — tap it to claim!
                  </>
                ) : (
                  <>
                    <b>{picker.scanned.displayName}</b> matches{" "}
                    {picker.eligibleTiles.length} squares — tap one to claim!
                  </>
                )
              ) : picker.result === "already_used" ? (
                <>
                  You already used <b>{picker.scanned.displayName}</b> — scan
                  someone new!
                </>
              ) : (
                <>
                  <b>{picker.scanned.displayName}</b> doesn&apos;t match any
                  open squares — chat anyway!
                </>
              )}
            </div>
            <button
              type="button"
              onClick={dismissPicker}
              aria-label={pickerActive ? "Skip" : "Dismiss"}
              className="shrink-0 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Claim error (shown when auto-claim or manual claim fails after rollback) ── */}
      {claimError && !picker ? (
        <div
          className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {claimError}
        </div>
      ) : null}

      <div
        role="grid"
        aria-label="Bingo card"
        className={[
          "grid grid-cols-5 gap-1.5",
          showFixedBanner ? "mt-16" : "",
        ].join(" ")}
      >
        {Array.from({ length: TOTAL }, (_, pos) => {
          const sq = byPosition.get(pos);
          const isFree = pos === FREE_POSITION;
          const claimed = sq?.claimed ?? false;
          const isOptimistic = optimisticClaim?.position === pos;
          const isLastClaimed = lastClaimedPos === pos;
          const showAsClaimed = claimed || isOptimistic;
          const isEligible = eligiblePositions.has(pos);
          const isDimmed = pickerActive && !isEligible && !showAsClaimed && !isFree;
          return (
            <button
              key={pos}
              type="button"
              role="gridcell"
              disabled={submitting && isEligible}
              onClick={() => {
                if (!sq) return;
                if (isEligible) {
                  void claimSquare(pos);
                  return;
                }
                setActive(sq);
              }}
              aria-disabled={isDimmed}
              className={[
                "relative flex aspect-square flex-col items-center justify-center rounded border p-1 text-center text-[10px] leading-tight transition",
                isFree
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : isOptimistic
                    ? "border-green-400 bg-green-50 text-green-800 motion-safe:animate-pulse"
                    : isLastClaimed
                      ? "border-green-500 bg-green-100 text-green-900 shadow-[0_0_0_2px_rgba(34,197,94,0.5)]"
                      : claimed
                        ? "border-green-500 bg-green-100 text-green-900"
                        : isEligible
                          ? "border-amber-400 bg-amber-50 text-amber-900 shadow-[0_0_0_2px_rgba(251,191,36,0.7)] motion-safe:animate-pulse"
                          : isDimmed
                            ? "border-zinc-200 bg-white text-zinc-400 opacity-40"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
              ].join(" ")}
            >
              <span className="line-clamp-3 font-medium">
                {isFree ? "FREE" : (sq?.squareText ?? "—")}
              </span>
              {showAsClaimed && !isFree ? (
                <span className="absolute bottom-1 right-1 text-xs" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── Reveal modal (post-claim) ── */}
      {reveal ? (
        <div
          role="dialog"
          aria-modal
          aria-busy={reveal.loading}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4"
          onClick={() => { if (!reveal.loading) dismissReveal(); }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {reveal.bingo ? (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-100 to-amber-50 px-3 py-2.5 text-center text-base font-bold tracking-wide text-amber-900">
                <Sparkles size={18} /> BINGO! <Sparkles size={18} />
              </div>
            ) : null}
            {reveal.loading ? (
              <div className="space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200" />
              </div>
            ) : reveal.conversationPrompt ? (
              <div className="rounded-lg bg-zinc-50 p-4">
                <div className="flex items-start gap-2.5">
                  <MessageCircle size={18} className="mt-0.5 shrink-0 text-zinc-400" />
                  <p className="text-base font-medium leading-relaxed text-zinc-900">
                    {reveal.conversationPrompt}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-zinc-500">
                {reveal.squareText}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                <Check size={12} />
                {reveal.viaDisplayName}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissReveal}
              disabled={reveal.loading}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {reveal.loading ? "Loading…" : "Done"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Square detail modal ── */}
      {active ? (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-semibold leading-tight text-zinc-900">
              {active.kind === "free" ? "Showed up" : active.squareText}
            </div>
            {active.conversationPrompt ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {active.conversationPrompt}
              </p>
            ) : null}
            <p className="mt-4 text-xs text-zinc-500">
              {active.claimed && active.viaDisplayName
                ? `Claimed via ${active.viaDisplayName}.`
                : active.claimed
                  ? "Claimed."
                  : active.kind === "free"
                    ? "Always marked."
                    : "Scan a teammate's QR to claim this square when they match."}
            </p>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md border border-zinc-200 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
