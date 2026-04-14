import Link from "next/link";
import type { ReactNode } from "react";

export type TabDef = {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
  hidden?: boolean;
};

export function Tabs({
  tabs,
  active,
  baseHref,
  queryParam = "tab",
  trailing,
}: {
  tabs: TabDef[];
  active: string;
  baseHref: string;
  queryParam?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Sections">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => {
            const isActive = t.key === active;
            const href = `${baseHref}?${queryParam}=${t.key}`;
            return (
              <Link
                key={t.key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={t.disabled || undefined}
                className={[
                  "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm transition",
                  "border-b-2",
                  isActive
                    ? "border-zinc-900 font-semibold text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-900",
                  t.disabled ? "pointer-events-none opacity-40" : "",
                ].join(" ")}
              >
                {t.label}
                {typeof t.count === "number" ? (
                  <span
                    className={`rounded-full px-1.5 text-[11px] leading-[18px] ${
                      isActive
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
      </nav>
      {trailing ? <div className="pb-1.5">{trailing}</div> : null}
    </div>
  );
}
