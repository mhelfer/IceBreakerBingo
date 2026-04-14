// Pure aggregation helpers for the curation page.
// Keep DB I/O out of here so it's easy to unit-test.

import type { MatchRule } from "./traits";

export type QuestionType =
  | "single"
  | "multi"
  | "binary"
  | "text"
  | "numeric_bucket";

export type ResponseValue = string | string[] | null;

// Count, per option bucket, how many players picked that bucket.
// For single/binary/numeric_bucket, a response contributes to exactly one
// bucket. For multi, a response contributes to each option it contains.
export function bucketCounts(
  type: QuestionType,
  responses: ResponseValue[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of responses) {
    if (r == null) continue;
    if (type === "multi") {
      if (!Array.isArray(r)) continue;
      for (const v of r) {
        if (typeof v !== "string" || v.length === 0) continue;
        counts[v] = (counts[v] ?? 0) + 1;
      }
    } else {
      if (typeof r !== "string" || r.length === 0) continue;
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

// Number of players whose response to a text question is a non-empty string.
export function discoveryAnswerCount(responses: ResponseValue[]): number {
  let n = 0;
  for (const r of responses) {
    if (typeof r === "string" && r.trim().length > 0) n++;
  }
  return n;
}

export function nonEmptyTextAnswers(responses: ResponseValue[]): string[] {
  const out: string[] = [];
  for (const r of responses) {
    if (typeof r === "string" && r.trim().length > 0) out.push(r.trim());
  }
  return out;
}

// Trait is considered completable iff at least 3 matchers.
export const MIN_MATCHERS = 3;

export function cohortMatchersForRule(
  type: QuestionType,
  rule: MatchRule,
  counts: Record<string, number>,
): number {
  // For the rule shapes we emit (eq, includes), match count collapses to a
  // bucket lookup — both ops compare against `rule.value` per-response.
  return counts[rule.value] ?? 0;
}
