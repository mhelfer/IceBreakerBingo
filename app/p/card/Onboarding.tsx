"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QrCode, Scan, Trophy, Users } from "lucide-react";

type Step = {
  icon: ReactNode;
  iconBg: string;
  title: string;
  body: ReactNode;
};

const STEPS: Step[] = [
  {
    icon: <Users size={28} />,
    iconBg: "bg-emerald-100 text-emerald-700",
    title: "Welcome to IceBreaker Bingo!",
    body: "You\u2019re playing bingo with your team. Each square is a trait or interest \u2014 find teammates who match to fill your board.",
  },
  {
    icon: <QrCode size={28} />,
    iconBg: "bg-amber-100 text-amber-700",
    title: "Everyone has a QR code",
    body: (
      <>
        Tap{" "}
        <span className="font-semibold text-zinc-900">My QR</span>{" "}
        below to show yours. When a teammate scans it, they&apos;ll see
        which of their squares you match.
      </>
    ),
  },
  {
    icon: <Scan size={28} />,
    iconBg: "bg-amber-100 text-amber-700",
    title: "Scan to discover matches",
    body: (
      <>
        Tap{" "}
        <span className="font-semibold text-zinc-900">Scan</span>{" "}
        to open your camera. After scanning a teammate, matching squares
        light up &mdash; tap one to claim it and get a conversation starter.
      </>
    ),
  },
  {
    icon: <Trophy size={28} />,
    iconBg: "bg-emerald-100 text-emerald-700",
    title: "Complete a line for bingo!",
    body: "Fill a row, column, or diagonal to score. The free center square is already yours \u2014 that\u2019s your head start. Go meet your team!",
  },
];

function storageKey(eventId: string) {
  return `ibb:onboarded:${eventId}`;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Onboarding({ eventId }: { eventId: string }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey(eventId))) return;
    setVisible(true);
    // Delay mount state for entrance animation
    requestAnimationFrame(() => setMounted(true));
  }, [eventId]);

  useEffect(() => {
    if (visible && primaryRef.current) {
      primaryRef.current.focus();
    }
  }, [visible, step]);

  function dismiss() {
    localStorage.setItem(storageKey(eventId), "1");
    setExiting(true);
    const delay = prefersReducedMotion() ? 0 : 250;
    setTimeout(() => setVisible(false), delay);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="onboarding-title"
      className={[
        "fixed inset-0 z-50 flex items-end justify-center",
        "transition-opacity duration-200",
        mounted && !exiting ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Bottom sheet */}
      <div
        className={[
          "relative z-10 w-full max-w-md rounded-t-2xl bg-white px-6 pt-8 shadow-xl",
          "pb-[calc(env(safe-area-inset-bottom)+24px)]",
          "transition-transform duration-300 ease-out",
          mounted && !exiting
            ? "translate-y-0"
            : "translate-y-full",
          prefersReducedMotion()
            ? "!transition-none"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className={[
              "inline-flex h-16 w-16 items-center justify-center rounded-full",
              current.iconBg,
            ].join(" ")}
          >
            {current.icon}
          </div>
        </div>

        {/* Content */}
        <div className="mt-5 text-center">
          <h2
            id="onboarding-title"
            className="text-lg font-semibold tracking-tight text-zinc-900"
          >
            {current.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-600">
            {current.body}
          </p>
        </div>

        {/* Dot indicators */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                "h-1.5 rounded-full transition-all duration-200",
                i === step
                  ? "w-4 bg-zinc-900"
                  : "w-1.5 bg-zinc-300",
              ].join(" ")}
              aria-hidden
            />
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="h-11 flex-1 rounded-md text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              Back
            </button>
          ) : null}
          <button
            ref={primaryRef}
            type="button"
            onClick={next}
            className={[
              "h-11 rounded-md bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-700",
              step === 0 ? "w-full" : "flex-1",
            ].join(" ")}
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
