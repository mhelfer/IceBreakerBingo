"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialog({
  trigger,
  title,
  description,
  children,
  size = "md",
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: string;
  children: (close: () => void) => ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function open() {
    ref.current?.showModal();
  }
  function close() {
    ref.current?.close();
  }

  const widthClass =
    size === "sm"
      ? "w-full max-w-sm"
      : size === "lg"
        ? "w-full max-w-2xl"
        : "w-full max-w-md";

  return (
    <>
      {trigger(open)}
      {mounted ? (
        <dialog
          ref={ref}
          onClick={(e) => {
            if (e.target === ref.current) close();
          }}
          className="backdrop:bg-black/50 bg-transparent p-0 open:m-auto"
        >
          <div
            className={`${widthClass} overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">{children(close)}</div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
