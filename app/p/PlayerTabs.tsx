import Link from "next/link";
import { Grid3x3, QrCode, Scan } from "lucide-react";
import type { ComponentType } from "react";

type Tab = "card" | "qr" | "scan";

const TABS: {
  key: Tab;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "card", label: "Card", href: "/p/card", icon: Grid3x3 },
  { key: "qr", label: "My QR", href: "/p/qr", icon: QrCode },
  { key: "scan", label: "Scan", href: "/p/scan", icon: Scan },
];

export function PlayerTabs({ active }: { active: Tab }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-white/80"
      aria-label="Player navigation"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const isActive = t.key === active;
          const Icon = t.icon;
          return (
            <li key={t.key} className="flex-1">
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-0.5 px-2 pt-2.5 pb-4 text-[11px] transition",
                  isActive
                    ? "font-semibold text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900",
                ].join(" ")}
              >
                <Icon
                  size={20}
                  className={isActive ? "text-zinc-900" : "text-zinc-500"}
                />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
