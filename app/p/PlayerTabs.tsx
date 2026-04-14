import Link from "next/link";

type Tab = "card" | "qr" | "scan";

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: "card", label: "Card", href: "/p/card" },
  { key: "qr", label: "My QR", href: "/p/qr" },
  { key: "scan", label: "Scan", href: "/p/scan" },
];

export function PlayerTabs({ active }: { active: Tab }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white"
      aria-label="Player navigation"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key} className="flex-1">
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={`block px-2 py-3 text-center text-sm ${
                  isActive
                    ? "font-semibold text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
