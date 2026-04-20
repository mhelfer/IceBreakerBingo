"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { AlertCircle, Check, CheckCircle2, Loader2 } from "lucide-react";
import { upsertAnswer, submitSurvey } from "./actions";

export type SurveyQuestion = {
  id: string;
  prompt: string;
  type: "single" | "multi" | "binary" | "text" | "numeric_bucket";
  options: string[] | null;
  position: number;
};

type InitialAnswer = { id: string; value: unknown };

type AnswerState = {
  value: string | string[] | null;
  saving: boolean;
  saved: boolean;
};

function normalize(v: unknown): string | string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(String);
  return String(v);
}

function isAnswered(v: string | string[] | null): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return v.trim().length > 0;
}

export function SurveyForm({
  questions,
  initial,
  readOnly = false,
  initiallySubmitted = false,
}: {
  questions: SurveyQuestion[];
  initial: InitialAnswer[];
  readOnly?: boolean;
  initiallySubmitted?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const m: Record<string, AnswerState> = {};
    for (const a of initial) {
      m[a.id] = {
        value: normalize(a.value),
        saving: false,
        saved: a.value != null,
      };
    }
    return m;
  });
  const [missing, setMissing] = useState<string[] | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [surveyClosed, setSurveyClosed] = useState(false);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const saveVersions = useRef<Map<string, number>>(new Map());

  const debouncedUpdate = useCallback(
    (q: SurveyQuestion, next: string | string[] | null) => {
      const existing = debounceTimers.current.get(q.id);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        q.id,
        setTimeout(() => {
          debounceTimers.current.delete(q.id);
          update(q, next);
        }, 400),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function update(q: SurveyQuestion, next: string | string[] | null): void {
    const ver = (saveVersions.current.get(q.id) ?? 0) + 1;
    saveVersions.current.set(q.id, ver);

    setAnswers((prev) => ({
      ...prev,
      [q.id]: { ...prev[q.id], saving: true, saved: false },
    }));
    setSubmitted(false);

    const fd = new FormData();
    fd.set("question_id", q.id);
    fd.set("type", q.type);
    if (Array.isArray(next)) {
      for (const v of next) fd.append("value", v);
    } else if (next != null) {
      fd.set("value", next);
    }

    upsertAnswer(fd)
      .then(() => {
        if (saveVersions.current.get(q.id) !== ver) return;
        setAnswers((prev) => ({
          ...prev,
          [q.id]: { ...prev[q.id], saving: false, saved: true },
        }));
      })
      .catch((err: unknown) => {
        if (err instanceof Error && /not open/i.test(err.message)) {
          setSurveyClosed(true);
          return;
        }
        if (saveVersions.current.get(q.id) !== ver) return;
        setAnswers((prev) => ({
          ...prev,
          [q.id]: { ...prev[q.id], saving: false, saved: false },
        }));
        console.error("save failed", err);
      });
  }

  function onSubmit(): void {
    startSubmit(async () => {
      const res = await submitSurvey();
      if (!res.ok) {
        setMissing(res.missing);
      } else {
        setSubmitted(true);
        setMissing(null);
      }
    });
  }

  const totalAnswered = questions.filter((q) => {
    const a = answers[q.id];
    return a && isAnswered(a.value);
  }).length;
  const pct = questions.length === 0 ? 0 : (totalAnswered / questions.length) * 100;
  const allAnswered = totalAnswered === questions.length;

  // --- Survey closed mid-edit (caught from failed save) ---
  if (surveyClosed || readOnly) {
    return (
      <>
        <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <CheckCircle2 size={14} className="text-zinc-400" />
            Survey closed — the game will start soon.
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-5 pb-10">
          {questions.map((q, idx) => {
            const a = answers[q.id] ?? { value: null, saving: false, saved: false };
            return (
              <section
                key={q.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4"
              >
                <p className="text-sm font-medium text-zinc-600">
                  <span className="mr-1.5 text-zinc-400">{idx + 1}.</span>
                  {q.prompt}
                </p>
                <div className="mt-2 text-sm text-zinc-900">
                  {Array.isArray(a.value)
                    ? a.value.join(", ")
                    : a.value || (
                        <span className="italic text-zinc-400">No answer</span>
                      )}
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  // --- Editable mode (survey open) ---
  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
        {submitted ? (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={14} />
            Submitted! You can still update your answers until the survey closes.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-zinc-900">
                {totalAnswered} / {questions.length} answered
              </span>
              <span className="text-zinc-500">
                {allAnswered ? "Ready to submit" : "Keep going"}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 pt-5 pb-40">
        {questions.map((q, idx) => {
          const a = answers[q.id] ?? { value: null, saving: false, saved: false };
          return (
            <section
              key={q.id}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900">
                  <span className="mr-1.5 text-zinc-400">{idx + 1}.</span>
                  {q.prompt}
                </p>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {a.saving ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> saving
                    </span>
                  ) : a.saved ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Check size={10} /> saved
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="mt-3">
                {q.type === "text" ? (
                  <textarea
                    rows={3}
                    value={typeof a.value === "string" ? a.value : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: { ...prev[q.id], value: val },
                      }));
                      debouncedUpdate(q, val);
                    }}
                    onBlur={(e) => {
                      const existing = debounceTimers.current.get(q.id);
                      if (existing) {
                        clearTimeout(existing);
                        debounceTimers.current.delete(q.id);
                      }
                      update(q, e.target.value);
                    }}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Type your answer"
                  />
                ) : q.type === "single" ||
                  q.type === "binary" ||
                  q.type === "numeric_bucket" ? (
                  <div className="flex flex-col gap-1.5">
                    {(q.options ?? []).map((opt) => {
                      const selected = a.value === opt;
                      return (
                        <label
                          key={opt}
                          className={[
                            "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-sm transition",
                            selected
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
                          ].join(" ")}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={selected}
                              onChange={() => update(q, opt)}
                              className="sr-only"
                            />
                            {opt}
                          </span>
                          {selected ? <Check size={14} /> : null}
                        </label>
                      );
                    })}
                  </div>
                ) : q.type === "multi" ? (
                  <div className="flex flex-col gap-1.5">
                    {(q.options ?? []).map((opt) => {
                      const arr = Array.isArray(a.value) ? a.value : [];
                      const checked = arr.includes(opt);
                      return (
                        <label
                          key={opt}
                          className={[
                            "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-sm transition",
                            checked
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
                          ].join(" ")}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const adding = e.target.checked;
                                setAnswers((prev) => {
                                  const cur = Array.isArray(prev[q.id]?.value) ? (prev[q.id].value as string[]) : [];
                                  const next = adding
                                    ? [...cur, opt]
                                    : cur.filter((x) => x !== opt);
                                  debouncedUpdate(q, next);
                                  return { ...prev, [q.id]: { ...prev[q.id], value: next } };
                                });
                              }}
                              className="sr-only"
                            />
                            {opt}
                          </span>
                          {checked ? <Check size={14} /> : null}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {missing && missing.length > 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>Answer these first: {missing.join(", ")}</span>
            </div>
          ) : null}
          {submitted ? (
            <button
              type="button"
              disabled
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-medium text-white"
            >
              <Check size={14} /> Submitted
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!allAnswered || submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Submitting…
                </>
              ) : (
                "Submit survey"
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
