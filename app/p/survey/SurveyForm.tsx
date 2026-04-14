"use client";

import { useState, useTransition } from "react";
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

export function SurveyForm({
  questions,
  initial,
}: {
  questions: SurveyQuestion[];
  initial: InitialAnswer[];
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const m: Record<string, AnswerState> = {};
    for (const a of initial) {
      m[a.id] = { value: normalize(a.value), saving: false, saved: a.value != null };
    }
    return m;
  });
  const [missing, setMissing] = useState<string[] | null>(null);
  const [submitting, startSubmit] = useTransition();

  function update(q: SurveyQuestion, next: string | string[] | null): void {
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { value: next, saving: true, saved: false },
    }));

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
        setAnswers((prev) => ({
          ...prev,
          [q.id]: { value: next, saving: false, saved: true },
        }));
      })
      .catch((err: unknown) => {
        setAnswers((prev) => ({
          ...prev,
          [q.id]: { value: next, saving: false, saved: false },
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
        window.location.href = "/p/survey-done";
      }
    });
  }

  const totalAnswered = Object.values(answers).filter(
    (a) => a.saved || (a.value != null && !(Array.isArray(a.value) && a.value.length === 0)),
  ).length;
  const allAnswered = totalAnswered === questions.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-xs text-zinc-500">
        {totalAnswered} / {questions.length} answered
      </div>

      {questions.map((q, idx) => {
        const a = answers[q.id] ?? { value: null, saving: false, saved: false };
        return (
          <section
            key={q.id}
            className="rounded border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">
                <span className="text-zinc-400">{idx + 1}.</span> {q.prompt}
              </p>
              <span className="text-xs text-zinc-400">
                {a.saving ? "saving…" : a.saved ? "saved ✓" : ""}
              </span>
            </div>

            <div className="mt-3">
              {q.type === "text" ? (
                <textarea
                  rows={3}
                  value={typeof a.value === "string" ? a.value : ""}
                  onChange={(e) => update(q, e.target.value)}
                  onBlur={(e) => update(q, e.target.value)}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Type your answer"
                />
              ) : q.type === "single" ||
                q.type === "binary" ||
                q.type === "numeric_bucket" ? (
                <div className="flex flex-col gap-1">
                  {(q.options ?? []).map((opt) => (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={a.value === opt}
                        onChange={() => update(q, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : q.type === "multi" ? (
                <div className="flex flex-col gap-1">
                  {(q.options ?? []).map((opt) => {
                    const arr = Array.isArray(a.value) ? a.value : [];
                    const checked = arr.includes(opt);
                    return (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...arr, opt]
                              : arr.filter((x) => x !== opt);
                            update(q, next);
                          }}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      {missing && missing.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Answer these first: {missing.join(", ")}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!allAnswered || submitting}
        className="rounded bg-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit survey"}
      </button>
    </div>
  );
}
