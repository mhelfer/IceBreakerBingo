// Card generation — pure sampling helpers + an I/O shell.
//
// Invariants (see tests/cardGen.test.ts):
//   1. Every cohort square has ≥ MIN_MATCHERS non-self, non-absent matchers.
//   2. Every discovery square has ≥ MIN_MATCHERS non-self, non-absent
//      answerers on the source question.
//   3. A player's own cohort traits never appear on their own card.
//   4. Discovery squares are capped at DISCOVERY_CAP per card.
//   5. At most one discovery square per source question per card.
//   6. Disabled trait templates are never placed.
//   7. Absent players are excluded from all matcher pools (they still get
//      a card if rostered, but their card avoids absentee-only traits).

import type { MatchRule } from "./traits";
import type { ResponseValue } from "./curation";

export const TOTAL_SQUARES = 24;
export const DISCOVERY_CAP = Math.floor(TOTAL_SQUARES * 0.4); // = 9
export const MIN_MATCHERS = 3;
export const FREE_POSITION = 12;

export type TraitTemplateInfo = {
  id: string;
  question_id: string;
  kind: "cohort" | "discovery";
  enabled: boolean;
};

// trait_template_id → set of player_ids that satisfy it.
export type MatcherIndex = Map<string, Set<string>>;

export function matchesRule(rule: MatchRule, value: ResponseValue): boolean {
  if (value == null) return false;
  if (rule.op === "eq") {
    return typeof value === "string" && value === rule.value;
  }
  if (rule.op === "includes") {
    return Array.isArray(value) && value.includes(rule.value);
  }
  return false;
}

export function eligibleTraitsForPlayer({
  playerId,
  traits,
  matchers,
  nonAbsentPlayers,
}: {
  playerId: string;
  traits: TraitTemplateInfo[];
  matchers: MatcherIndex;
  nonAbsentPlayers: Set<string>;
}): TraitTemplateInfo[] {
  const out: TraitTemplateInfo[] = [];
  for (const t of traits) {
    if (!t.enabled) continue;
    const m = matchers.get(t.id);
    if (!m) continue;
    // Self can't claim their own cohort trait. Discovery is always about
    // teammates, so self matching is filtered the same way.
    if (m.has(playerId)) {
      if (t.kind === "cohort") continue;
      // Discovery: fine if self answered, but self still doesn't count
      // toward the 3-matcher threshold.
    }
    let n = 0;
    for (const pid of m) {
      if (pid === playerId) continue;
      if (!nonAbsentPlayers.has(pid)) continue;
      n++;
      if (n >= MIN_MATCHERS) break;
    }
    if (n < MIN_MATCHERS) continue;
    out.push(t);
  }
  return out;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sample TOTAL_SQUARES traits from the eligible pool. Throws if the pool
// isn't big enough — caller should surface that to the facilitator so they
// can add questions or re-open the survey.
export function sampleCardSquares({
  eligible,
  rng = Math.random,
}: {
  eligible: TraitTemplateInfo[];
  rng?: () => number;
}): TraitTemplateInfo[] {
  const cohortShuffled = shuffled(
    eligible.filter((t) => t.kind === "cohort"),
    rng,
  );
  const discoveryShuffled = shuffled(
    eligible.filter((t) => t.kind === "discovery"),
    rng,
  );

  // Dedupe discovery by source question — at most one per card.
  const seenQuestions = new Set<string>();
  const uniqueDiscovery: TraitTemplateInfo[] = [];
  for (const d of discoveryShuffled) {
    if (seenQuestions.has(d.question_id)) continue;
    seenQuestions.add(d.question_id);
    uniqueDiscovery.push(d);
  }

  const discoveryCount = Math.min(
    DISCOVERY_CAP,
    uniqueDiscovery.length,
    TOTAL_SQUARES,
  );
  const cohortNeeded = TOTAL_SQUARES - discoveryCount;

  if (cohortShuffled.length < cohortNeeded) {
    throw new Error(
      `Not enough traits to generate card: need ${cohortNeeded} cohort + ${discoveryCount} discovery, have ${cohortShuffled.length} cohort + ${uniqueDiscovery.length} discovery`,
    );
  }

  const picked = [
    ...uniqueDiscovery.slice(0, discoveryCount),
    ...cohortShuffled.slice(0, cohortNeeded),
  ];
  return shuffled(picked, rng);
}

export type PlacedSquare = { position: number; trait: TraitTemplateInfo };

export function assembleCardPositions(
  traits: TraitTemplateInfo[],
): PlacedSquare[] {
  if (traits.length !== TOTAL_SQUARES) {
    throw new Error(
      `assembleCardPositions expects ${TOTAL_SQUARES} traits, got ${traits.length}`,
    );
  }
  const out: PlacedSquare[] = [];
  let ti = 0;
  for (let pos = 0; pos <= 24; pos++) {
    if (pos === FREE_POSITION) continue;
    out.push({ position: pos, trait: traits[ti++] });
  }
  return out;
}

// ─── matcher-index building ──────────────────────────────────────────────

export type QuestionInfo = {
  id: string;
  type: "single" | "multi" | "binary" | "text" | "numeric_bucket";
};

export type TraitTemplateRecord = TraitTemplateInfo & {
  match_rule: MatchRule | null;
};

export type ResponseRecord = {
  player_id: string;
  question_id: string;
  value: ResponseValue;
};

// Build the trait_id → Set<player_id> index by evaluating each trait
// template's rule (or, for discovery, checking non-empty text answers)
// against the whole response table.
export function buildMatcherIndex({
  questions,
  traits,
  responses,
}: {
  questions: QuestionInfo[];
  traits: TraitTemplateRecord[];
  responses: ResponseRecord[];
}): MatcherIndex {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const responsesByQuestion = new Map<string, ResponseRecord[]>();
  for (const r of responses) {
    const arr = responsesByQuestion.get(r.question_id) ?? [];
    arr.push(r);
    responsesByQuestion.set(r.question_id, arr);
  }

  const index: MatcherIndex = new Map();
  for (const t of traits) {
    const q = questionById.get(t.question_id);
    if (!q) continue;
    const rs = responsesByQuestion.get(t.question_id) ?? [];
    const players = new Set<string>();

    if (t.kind === "discovery") {
      for (const r of rs) {
        if (typeof r.value === "string" && r.value.trim().length > 0) {
          players.add(r.player_id);
        }
      }
    } else {
      // cohort
      if (!t.match_rule) continue; // defensive — cohort w/o rule is malformed
      for (const r of rs) {
        if (matchesRule(t.match_rule, r.value)) {
          players.add(r.player_id);
        }
      }
    }
    index.set(t.id, players);
  }
  return index;
}
