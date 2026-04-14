"use client";

import { useEffect, useState } from "react";
import { FREE_POSITION } from "@/lib/cardGen";

export type SquareView = {
  position: number;
  squareText: string | null;
  conversationPrompt: string | null;
  kind: "cohort" | "discovery" | "free";
  claimed: boolean;
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

const PICKER_KEY = "ibb:picker";
const PICKER_TTL_MS = 3 * 60 * 1000; // matches the 3-min idle dismiss rule
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

export function CardGrid({ squares }: { squares: SquareView[] }) {
  const byPosition = new Map(squares.map((s) => [s.position, s]));
  const [active, setActive] = useState<SquareView | null>(null);
  const [picker, setPicker] = useState<PickerPayload | null>(null);

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
              onClick={() => {
                if (!sq) return;
                if (isEligible) {
                  // Claims API lands in Phase 5. For now, acknowledge the
                  // pick by clearing picker state so the tester can see the
                  // full flow up to the claim moment.
                  alert(
                    `Would claim "${sq.squareText ?? "free"}" via ${picker!.scanned.displayName}. Claim API ships in Phase 5.`,
                  );
                  dismissPicker();
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
              {active.claimed
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
