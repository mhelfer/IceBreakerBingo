"use client";

import { useEffect, useRef, useState } from "react";
import { SaveStatus } from "./SquareTextEditor";

const DEBOUNCE_MS = 600;
type SaveState = "idle" | "saving" | "saved" | "error";

export function PromptEditor({
  action,
  initial,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: string;
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
      fd.set("conversation_prompt", text);
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

  return (
    <div className="flex flex-col gap-1">
      <input
        name="conversation_prompt"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
      />
      <div className="flex items-center justify-end text-[10px]">
        <SaveStatus status={status} />
      </div>
    </div>
  );
}
