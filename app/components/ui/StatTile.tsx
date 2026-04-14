import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-800"
      : tone === "success"
        ? "text-emerald-800"
        : "text-zinc-900";
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {icon ? <span className="text-zinc-400">{icon}</span> : null}
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}
