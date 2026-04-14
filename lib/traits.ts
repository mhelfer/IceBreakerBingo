// Helpers for auto-generating trait_templates from a survey_question.
// Cohort rule shapes, kept tiny and explicit so card-gen can evaluate them
// without a general expression engine.

import type { Database } from "./db-types";

export type QuestionType = Database["public"]["Enums"]["question_type"];

export type MatchRule =
  | { op: "eq"; value: string } // single, binary, numeric_bucket
  | { op: "includes"; value: string }; // multi

export type TraitTemplateSeed = {
  kind: "cohort" | "discovery";
  match_rule: MatchRule | null;
  square_text: string;
  conversation_prompt: string | null;
};

function clip(s: string, n = 36): string {
  return s.length <= n ? s : s.slice(0, n);
}

// Default cohort wording used when a facilitator adds a new question without
// custom trait text. Kept generic on purpose — good enough to play, and the
// facilitator can rewrite before lock.
function defaultCohortSeed(
  prompt: string,
  option: string,
  op: MatchRule["op"],
): TraitTemplateSeed {
  return {
    kind: "cohort",
    match_rule: { op, value: option },
    square_text: clip(`${option}`),
    conversation_prompt: `Ask about their "${option}" answer to "${prompt}".`,
  };
}

function defaultDiscoverySeed(prompt: string): TraitTemplateSeed {
  return {
    kind: "discovery",
    match_rule: null,
    square_text: clip(`Learn: ${prompt}`),
    conversation_prompt: null,
  };
}

export function seedsForQuestion(
  type: QuestionType,
  prompt: string,
  options: string[] | null,
): TraitTemplateSeed[] {
  if (type === "text") return [defaultDiscoverySeed(prompt)];
  const opts = options ?? [];
  const op: MatchRule["op"] = type === "multi" ? "includes" : "eq";
  return opts.map((o) => defaultCohortSeed(prompt, o, op));
}
