"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "./Button";

export function CopyButton({
  value,
  label = "Copy",
  doneLabel = "Copied",
  variant = "secondary",
  size = "sm",
  iconOnly = false,
  className = "",
}: {
  value: string;
  label?: string;
  doneLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  iconOnly?: boolean;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* ignore */
    }
  }

  const iconSize = size === "md" ? 14 : 12;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={done ? doneLabel : label}
        title={done ? doneLabel : label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        {done ? (
          <Check size={iconSize} className="text-emerald-600" />
        ) : (
          <Copy size={iconSize} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`${buttonClass(variant, size)} ${className}`.trim()}
    >
      {done ? (
        <Check size={iconSize} className="text-emerald-600" />
      ) : (
        <Copy size={iconSize} />
      )}
      {done ? doneLabel : label}
    </button>
  );
}
