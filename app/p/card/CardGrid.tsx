"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
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
  const confettiFired = useRef(false);

  useEffect(() => {
    setPicker(loadPicker());
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
    setSubmitting(true);
    setClaimError(null);
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
        setClaimError(body.ok === false ? body.error : "claim failed");
        setSubmitting(false);
        return;
      }
      dismissPicker();
      setReveal({ ...body.reveal, bingo: body.bingo });
      if (body.bingo && !confettiFired.current) {
        confettiFired.current = true;
        fireBingoConfetti();
      }
    } catch {
      setClaimError("network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  function dismissReveal() {
    setReveal(null);
    confettiFired.current = false;
    router.refresh();
  }

  return (
    <>
      {picker ? (
        <div
          className={`mb-3 rounded border p-3 text-sm ${
            picker.result === "eligible"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
          role="status"
        >
          <div className="flex items-center justify-between gap-2">
            <span>
              {picker.result === "eligible" ? (
                <>
                  ⚡ <b>{picker.scanned.displayName}</b> matches{" "}
                  {picker.eligibleTiles.length}{" "}
                  {picker.eligibleTiles.length === 1 ? "square" : "squares"} —
                  tap one to claim.
                </>
              ) : picker.result === "already_used" ? (
                <>You already used {picker.scanned.displayName}.</>
              ) : (
                <>
                  {picker.scanned.displayName} doesn&apos;t match any open
                  squares — chat anyway!
                </>
              )}
            </span>
            <button
              type="button"
              onClick={dismissPicker}
              className="shrink-0 rounded px-2 py-1 text-xs underline"
            >
              {picker.result === "eligible" ? "Skip →" : "Dismiss"}
            </button>
          </div>
          {claimError ? (
            <p className="mt-2 text-xs text-red-700">{claimError}</p>
          ) : null}
        </div>
      ) : null}

      <div
        role="grid"
        aria-label="Bingo card"
        className="grid grid-cols-5 gap-1.5"
      >
        {Array.from({ length: TOTAL }, (_, pos) => {
          const sq = byPosition.get(pos);
          const isFree = pos === FREE_POSITION;
          const claimed = sq?.claimed ?? false;
          const isEligible = eligiblePositions.has(pos);
          const isDimmed = pickerActive && !isEligible && !claimed && !isFree;
          const glyph = isFree
            ? "★"
            : sq?.kind === "discovery"
              ? "💬"
              : "🔖";
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
                  : claimed
                    ? "border-green-500 bg-green-100 text-green-900"
                    : isEligible
                      ? "border-amber-400 bg-amber-50 text-amber-900 shadow-[0_0_0_2px_rgba(251,191,36,0.7)] motion-safe:animate-pulse"
                      : isDimmed
                        ? "border-zinc-200 bg-white text-zinc-400 opacity-40"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
              ].join(" ")}
            >
              <span
                className="absolute right-1 top-1 text-[10px] opacity-70"
                aria-hidden
              >
                {glyph}
              </span>
              <span className="line-clamp-3 font-medium">
                {isFree ? "FREE" : (sq?.squareText ?? "—")}
              </span>
              {claimed && !isFree ? (
                <span className="absolute bottom-1 right-1 text-xs" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {reveal ? (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4"
          onClick={dismissReveal}
        >
          <div
            className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {reveal.bingo ? (
              <div className="mb-3 rounded bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-900">
                ✨🎉 BINGO! 🎉✨
              </div>
            ) : null}
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              {reveal.kind === "discovery" ? "💬 Discovery" : "🔖 Cohort"}
            </div>
            <div className="text-lg font-semibold">{reveal.squareText}</div>
            <div className="mt-3 text-sm text-green-700">
              Claimed with {reveal.viaDisplayName}!
            </div>
            <p className="mt-3 text-sm text-zinc-700">
              {reveal.conversationPrompt}
            </p>
            <p className="mt-4 text-xs text-zinc-500">
              💡 Don&apos;t forget to let {reveal.viaDisplayName} scan you back.
            </p>
            <button
              type="button"
              onClick={dismissReveal}
              className="mt-5 w-full rounded bg-black py-2 text-sm text-white hover:bg-zinc-800"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {active ? (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              {active.kind === "free"
                ? "Free space"
                : active.kind === "discovery"
                  ? "💬 Discovery"
                  : "🔖 Cohort"}
            </div>
            <div className="text-lg font-semibold">
              {active.kind === "free" ? "Showed up" : active.squareText}
            </div>
            {active.conversationPrompt ? (
              <p className="mt-3 text-sm text-zinc-600">
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
              className="mt-5 w-full rounded bg-black py-2 text-sm text-white hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
