"use client";

import { useEffect, useRef, useState } from "react";
import { SQUARE_TEXT_MAX, isPlaceholderSquareText } from "./squareText";

const DEBOUNCE_MS = 600;
type SaveState = "idle" | "saving" | "saved" | "error";

export function SquareTextEditor({
  action,
  initial,
  kind,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: string;
  kind: "cohort" | "discovery";
}) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<SaveState>("idle");
  const lastSaved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      const fd = new FormData();
      fd.set("square_text", text);
      try {
        await action(fd);
        lastSaved.current = text;
        setStatus("saved");
        if (savedFadeTimer.current) clearTimeout(savedFadeTimer.current);
        savedFadeTimer.current = setTimeout(
          () => setStatus((s) => (s === "saved" ? "idle" : s)),
          1500,
        );
      } catch {
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, action]);

  const glyph = kind === "discovery" ? "💬" : "🔖";
  const count = text.length;
  const placeholder = isPlaceholderSquareText(text);
  const countColor =
    count > SQUARE_TEXT_MAX
      ? "text-red-600"
      : placeholder
        ? "text-amber-700"
        : "text-zinc-500";

  return (
    <div className="flex items-start gap-3">
      <div
        aria-hidden
        className="relative flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded border border-zinc-200 bg-white p-1 text-center text-[10px] leading-tight text-zinc-700"
      >
        <span className="absolute right-1 top-1 text-[10px] opacity-70">
          {glyph}
        </span>
        <span className="line-clamp-3 font-medium">{text || "—"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <input
          name="square_text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SQUARE_TEXT_MAX}
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
        />
        <div className="flex items-center justify-between text-[10px]">
          <span className={countColor}>
            {count}/{SQUARE_TEXT_MAX}
            {placeholder ? " · placeholder" : ""}
          </span>
          <SaveStatus status={status} />
        </div>
      </div>
    </div>
  );
}

export function SaveStatus({ status }: { status: SaveState }) {
  if (status === "saving") return <span className="text-zinc-400">saving…</span>;
  if (status === "saved") return <span className="text-green-600">✓ saved</span>;
  if (status === "error") return <span className="text-red-600">save failed</span>;
  return <span className="text-zinc-300">&nbsp;</span>;
}
