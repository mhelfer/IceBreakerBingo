"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

type Item =
  | {
      kind: "action";
      label: string;
      onSelect: () => void;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
    }
  | { kind: "divider" };

export function DropdownMenu({
  items,
  align = "right",
  label = "Open menu",
  trigger,
}: {
  items: Item[];
  align?: "left" | "right";
  label?: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        {trigger ?? <MoreHorizontal size={18} />}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => {
            if (item.kind === "divider") {
              return <div key={i} className="my-1 h-px bg-zinc-100" />;
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect();
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  item.danger
                    ? "text-red-700 hover:bg-red-50"
                    : "text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                {item.icon ? (
                  <span className="text-zinc-400">{item.icon}</span>
                ) : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
