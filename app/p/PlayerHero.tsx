import type { ReactNode } from "react";

export function PlayerHero({
  icon,
  eyebrow,
  title,
  body,
  footer,
  tone = "default",
}: {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "muted" | "warning";
}) {
  const iconBg =
    tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "muted"
        ? "bg-zinc-100 text-zinc-500"
        : "bg-emerald-100 text-emerald-700";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50/60 px-6 py-10">
      <div className="w-full max-w-sm text-center">
        {icon ? (
          <div
            className={`mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}
          >
            {icon}
          </div>
        ) : null}
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {body ? (
          <div className="mt-3 text-sm leading-relaxed text-zinc-600">
            {body}
          </div>
        ) : null}
        {footer ? (
          <div className="mt-6 text-xs text-zinc-400">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}
