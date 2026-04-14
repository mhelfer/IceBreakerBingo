"use client";

import { ChevronDown, GripVertical, ListChecks, Plus, Trash2 } from "lucide-react";
import { buttonClass, Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Input, Label, Select, Textarea } from "@/app/components/ui/Input";
import { Dialog } from "@/app/components/ui/Dialog";
import {
  addQuestion,
  addQuestionOption,
  deleteQuestion,
  forkStarterQuestions,
  moveQuestion,
  removeQuestionOption,
  updateQuestionPrompt,
} from "./actions";
import type { EventState } from "@/app/components/ui/StatePill";

type QuestionRow = {
  id: string;
  prompt: string;
  type: "single" | "multi" | "binary" | "text" | "numeric_bucket";
  options: string[] | null;
  position: number;
};

const TYPE_LABEL: Record<QuestionRow["type"], string> = {
  single: "single select",
  multi: "multi select",
  binary: "binary",
  text: "free text",
  numeric_bucket: "numeric bucket",
};

export function QuestionsSection({
  eventCode,
  state,
  questions,
}: {
  eventCode: string;
  state: EventState;
  questions: QuestionRow[];
}) {
  const canReorder = state === "draft";
  const canEditPrompts = state === "draft" || state === "survey_open";
  const canAddOption = state === "draft" || state === "survey_open";
  const canRemoveOption = state === "draft";
  const frozen = !canEditPrompts;

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks size={18} />}
        title="No questions yet"
        body={
          state === "draft"
            ? "Start from the built-in template, then tweak wording and options to match your team."
            : "Questions are frozen for this state."
        }
        action={
          state === "draft" ? (
            <form action={forkStarterQuestions.bind(null, eventCode)}>
              <Button type="submit" variant="primary" size="md">
                Load starter template
              </Button>
            </form>
          ) : null
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {frozen ? (
        <p className="text-xs text-zinc-500">
          Questions are frozen — state is {state.replace(/_/g, " ")}.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            q={q}
            idx={idx}
            total={questions.length}
            eventCode={eventCode}
            canReorder={canReorder}
            canEditPrompts={canEditPrompts}
            canAddOption={canAddOption}
            canRemoveOption={canRemoveOption}
          />
        ))}
      </ul>

      {canEditPrompts ? <AddQuestionDialog eventCode={eventCode} /> : null}
    </div>
  );
}

function QuestionCard({
  q,
  idx,
  total,
  eventCode,
  canReorder,
  canEditPrompts,
  canAddOption,
  canRemoveOption,
}: {
  q: QuestionRow;
  idx: number;
  total: number;
  eventCode: string;
  canReorder: boolean;
  canEditPrompts: boolean;
  canAddOption: boolean;
  canRemoveOption: boolean;
}) {
  const expandable = canEditPrompts || (q.options && q.options.length > 0);
  const initiallyOpen = !canEditPrompts && !!q.options?.length; // when frozen, show options
  const defaultOpenAll = false; // collapsed by default; user expands what they want

  return (
    <Card as="li" className="overflow-hidden">
      <details open={initiallyOpen || defaultOpenAll} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-zinc-50/80">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 font-mono text-[11px] font-semibold text-zinc-600">
            {idx + 1}
          </span>
          <span className="inline-flex shrink-0 items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
            {TYPE_LABEL[q.type]}
          </span>
          <span className="flex-1 truncate text-sm text-zinc-900">
            {q.prompt}
          </span>
          {q.type !== "text" && q.options ? (
            <span className="shrink-0 text-[11px] text-zinc-500">
              {q.options.length} options
            </span>
          ) : null}
          {expandable ? (
            <ChevronDown
              size={16}
              className="shrink-0 text-zinc-400 transition group-open:rotate-180"
            />
          ) : null}
        </summary>

        <div className="flex flex-col gap-4 border-t border-zinc-100 bg-zinc-50/40 px-4 py-4">
          {canEditPrompts ? (
            <form
              action={updateQuestionPrompt.bind(null, eventCode, q.id)}
              className="flex flex-col gap-1.5"
            >
              <Label>Prompt</Label>
              <div className="flex gap-2">
                <Input
                  name="prompt"
                  defaultValue={q.prompt}
                  required
                  maxLength={200}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" size="md">
                  Save
                </Button>
              </div>
            </form>
          ) : null}

          {q.type !== "text" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Options</Label>
              <div className="flex flex-wrap gap-1.5">
                {(q.options ?? []).map((opt) => (
                  <span
                    key={opt}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
                  >
                    {opt}
                    {canRemoveOption && q.type !== "binary" ? (
                      <form
                        action={removeQuestionOption.bind(
                          null,
                          eventCode,
                          q.id,
                          opt,
                        )}
                      >
                        <button
                          type="submit"
                          className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 hover:bg-red-100 hover:text-red-600"
                          aria-label={`Remove ${opt}`}
                        >
                          ×
                        </button>
                      </form>
                    ) : null}
                  </span>
                ))}
                {canAddOption && q.type !== "binary" ? (
                  <form
                    action={addQuestionOption.bind(null, eventCode, q.id)}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Input
                      name="option"
                      placeholder="Add option…"
                      required
                      className="h-7 w-36 px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
                      aria-label="Add option"
                    >
                      <Plus size={13} />
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}

          {canReorder ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              <GripVertical size={13} className="text-zinc-400" />
              <form
                action={moveQuestion.bind(null, eventCode, q.id, "up")}
                className="contents"
              >
                <button
                  type="submit"
                  disabled={idx === 0}
                  className={buttonClass("ghost", "sm")}
                >
                  ↑ Move up
                </button>
              </form>
              <form
                action={moveQuestion.bind(null, eventCode, q.id, "down")}
                className="contents"
              >
                <button
                  type="submit"
                  disabled={idx === total - 1}
                  className={buttonClass("ghost", "sm")}
                >
                  ↓ Move down
                </button>
              </form>
              <div className="ml-auto">
                <form
                  action={deleteQuestion.bind(null, eventCode, q.id)}
                  className="contents"
                >
                  <button type="submit" className={buttonClass("danger", "sm")}>
                    <Trash2 size={12} /> Delete
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </Card>
  );
}

function AddQuestionDialog({ eventCode }: { eventCode: string }) {
  const typeOptions: {
    value: QuestionRow["type"];
    label: string;
    hint: string;
  }[] = [
    { value: "text", label: "Free text", hint: "Hidden talents, hometowns, etc." },
    { value: "single", label: "Single select", hint: "Pick one option." },
    { value: "multi", label: "Multi select", hint: "Pick any that apply." },
    { value: "binary", label: "Binary", hint: "Two options — tabs vs. spaces." },
    {
      value: "numeric_bucket",
      label: "Numeric bucket",
      hint: "Ranges like years-coding.",
    },
  ];

  return (
    <Dialog
      title="Add a question"
      description="You can keep editing wording and options after opening the survey."
      trigger={(open) => (
        <Button
          type="button"
          onClick={open}
          variant="secondary"
          size="md"
          className="self-start"
        >
          <Plus size={14} /> Add question
        </Button>
      )}
    >
      {(close) => (
        <form
          action={addQuestion.bind(null, eventCode)}
          className="flex flex-col gap-4"
          onSubmit={() => {
            // close on submit; the action will refresh the page.
            setTimeout(close, 0);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aq-prompt">Prompt</Label>
            <Input
              id="aq-prompt"
              name="prompt"
              required
              maxLength={200}
              placeholder="What's your favorite debug snack?"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aq-type">Type</Label>
            <Select id="aq-type" name="type" defaultValue="text">
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.hint}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aq-options">
              Options <span className="text-zinc-400">(one per line, required for non-text)</span>
            </Label>
            <Textarea
              id="aq-options"
              name="options"
              rows={4}
              placeholder={"Option A\nOption B"}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add question
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
