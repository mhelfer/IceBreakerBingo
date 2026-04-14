import {
  CircleDot,
  CircleDashed,
  CircleCheck,
  Lock,
  Play,
  Square,
  type LucideIcon,
} from "lucide-react";

export type EventState =
  | "draft"
  | "survey_open"
  | "survey_closed"
  | "curation_locked"
  | "live"
  | "ended";

const META: Record<
  EventState,
  { label: string; bg: string; fg: string; icon: LucideIcon }
> = {
  draft: {
    label: "Draft",
    bg: "bg-zinc-100",
    fg: "text-zinc-700",
    icon: CircleDashed,
  },
  survey_open: {
    label: "Survey open",
    bg: "bg-sky-100",
    fg: "text-sky-800",
    icon: CircleDot,
  },
  survey_closed: {
    label: "Survey closed",
    bg: "bg-amber-100",
    fg: "text-amber-800",
    icon: CircleCheck,
  },
  curation_locked: {
    label: "Curation locked",
    bg: "bg-violet-100",
    fg: "text-violet-800",
    icon: Lock,
  },
  live: {
    label: "Live",
    bg: "bg-emerald-100",
    fg: "text-emerald-800",
    icon: Play,
  },
  ended: {
    label: "Ended",
    bg: "bg-zinc-200",
    fg: "text-zinc-800",
    icon: Square,
  },
};

export function StatePill({
  state,
  size = "md",
}: {
  state: EventState;
  size?: "sm" | "md";
}) {
  const m = META[state];
  const Icon = m.icon;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const iconSize = size === "sm" ? 11 : 13;
  const dot = state === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${m.bg} ${m.fg} ${pad}`}
    >
      {dot ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <Icon size={iconSize} strokeWidth={2.25} />
      )}
      {m.label}
    </span>
  );
}
