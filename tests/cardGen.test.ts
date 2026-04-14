import { describe, expect, it } from "vitest";
import {
  DISCOVERY_CAP,
  MIN_MATCHERS,
  TOTAL_SQUARES,
  assembleCardPositions,
  buildMatcherIndex,
  eligibleTraitsForPlayer,
  matchesRule,
  sampleCardSquares,
  type MatcherIndex,
  type TraitTemplateInfo,
  type TraitTemplateRecord,
} from "@/lib/cardGen";

// Deterministic RNG so shuffles are reproducible in tests.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function cohort(id: string, qid = `q-${id}`): TraitTemplateInfo {
  return { id, question_id: qid, kind: "cohort", enabled: true };
}
function discovery(id: string, qid: string): TraitTemplateInfo {
  return { id, question_id: qid, kind: "discovery", enabled: true };
}

// ─── matchesRule ──────────────────────────────────────────────────────────

describe("matchesRule", () => {
  it("eq matches exact string", () => {
    expect(matchesRule({ op: "eq", value: "Python" }, "Python")).toBe(true);
    expect(matchesRule({ op: "eq", value: "Python" }, "Go")).toBe(false);
  });

  it("eq rejects arrays and null", () => {
    expect(matchesRule({ op: "eq", value: "Python" }, null)).toBe(false);
    expect(matchesRule({ op: "eq", value: "Python" }, ["Python"])).toBe(false);
  });

  it("includes matches when array contains value", () => {
    expect(
      matchesRule({ op: "includes", value: "Dog" }, ["Cat", "Dog"]),
    ).toBe(true);
    expect(matchesRule({ op: "includes", value: "Dog" }, ["Cat"])).toBe(false);
  });

  it("includes rejects string / null", () => {
    expect(matchesRule({ op: "includes", value: "Dog" }, "Dog")).toBe(false);
    expect(matchesRule({ op: "includes", value: "Dog" }, null)).toBe(false);
  });
});

// ─── eligibleTraitsForPlayer ──────────────────────────────────────────────

describe("eligibleTraitsForPlayer", () => {
  const alice = "p-alice";
  const others = (ids: string[]): Set<string> => new Set(ids);

  it("drops cohort traits with fewer than MIN_MATCHERS other matchers", () => {
    const traits = [cohort("t1"), cohort("t2")];
    const matchers: MatcherIndex = new Map([
      ["t1", new Set(["p-b", "p-c", "p-d"])], // 3 others
      ["t2", new Set(["p-b", "p-c"])], // 2 others — drop
    ]);
    const out = eligibleTraitsForPlayer({
      playerId: alice,
      traits,
      matchers,
      nonAbsentPlayers: others(["p-b", "p-c", "p-d"]),
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });

  it("excludes self from cohort traits on own card", () => {
    const traits = [cohort("t1")];
    const matchers: MatcherIndex = new Map([
      ["t1", new Set([alice, "p-b", "p-c"])], // alice matches
    ]);
    const out = eligibleTraitsForPlayer({
      playerId: alice,
      traits,
      matchers,
      nonAbsentPlayers: others([alice, "p-b", "p-c"]),
    });
    expect(out).toHaveLength(0);
  });

  it("counts self toward the threshold for neither cohort nor discovery", () => {
    const traits = [cohort("t1"), discovery("d1", "q1")];
    const matchers: MatcherIndex = new Map([
      // t1: 2 others + self → should fail MIN_MATCHERS since self doesn't count
      ["t1", new Set(["p-b", "p-c"])], // alice not in the cohort matchers
      ["d1", new Set([alice, "p-b", "p-c"])], // 2 non-self answerers
    ]);
    const out = eligibleTraitsForPlayer({
      playerId: alice,
      traits,
      matchers,
      nonAbsentPlayers: others([alice, "p-b", "p-c"]),
    });
    expect(out).toHaveLength(0);
  });

  it("excludes absent players from matcher count", () => {
    const traits = [cohort("t1")];
    const matchers: MatcherIndex = new Map([
      ["t1", new Set(["p-b", "p-c", "p-d"])],
    ]);
    // Only p-b is present — one matcher — below threshold
    const out = eligibleTraitsForPlayer({
      playerId: alice,
      traits,
      matchers,
      nonAbsentPlayers: others(["p-b"]),
    });
    expect(out).toHaveLength(0);
  });

  it("excludes disabled traits", () => {
    const traits = [{ ...cohort("t1"), enabled: false }];
    const matchers: MatcherIndex = new Map([
      ["t1", new Set(["p-b", "p-c", "p-d", "p-e"])],
    ]);
    const out = eligibleTraitsForPlayer({
      playerId: alice,
      traits,
      matchers,
      nonAbsentPlayers: others(["p-b", "p-c", "p-d", "p-e"]),
    });
    expect(out).toHaveLength(0);
  });

  it("keeps discovery traits with enough non-self answerers", () => {
    const traits = [discovery("d1", "q1")];
    const matchers: MatcherIndex = new Map([
      ["d1", new Set(["p-b", "p-c", "p-d"])],
    ]);
    const out = eligibleTraitsForPlayer({
      playerId: alice,
      traits,
      matchers,
      nonAbsentPlayers: others(["p-b", "p-c", "p-d"]),
    });
    expect(out.map((t) => t.id)).toEqual(["d1"]);
  });
});

// ─── sampleCardSquares ────────────────────────────────────────────────────

describe("sampleCardSquares", () => {
  function buildPool({
    cohorts,
    discoveries,
  }: {
    cohorts: number;
    discoveries: Array<{ id: string; qid: string }>;
  }) {
    const c: TraitTemplateInfo[] = [];
    for (let i = 0; i < cohorts; i++) c.push(cohort(`c${i}`));
    const d: TraitTemplateInfo[] = discoveries.map((x) =>
      discovery(x.id, x.qid),
    );
    return [...c, ...d];
  }

  it("returns exactly TOTAL_SQUARES squares", () => {
    const pool = buildPool({
      cohorts: 30,
      discoveries: Array.from({ length: 12 }, (_, i) => ({
        id: `d${i}`,
        qid: `q${i}`,
      })),
    });
    const out = sampleCardSquares({ eligible: pool, rng: seededRng(1) });
    expect(out).toHaveLength(TOTAL_SQUARES);
  });

  it("caps discovery at DISCOVERY_CAP", () => {
    const pool = buildPool({
      cohorts: 20,
      discoveries: Array.from({ length: 20 }, (_, i) => ({
        id: `d${i}`,
        qid: `q${i}`,
      })),
    });
    const out = sampleCardSquares({ eligible: pool, rng: seededRng(2) });
    const disc = out.filter((t) => t.kind === "discovery").length;
    expect(disc).toBeLessThanOrEqual(DISCOVERY_CAP);
    expect(disc).toBe(DISCOVERY_CAP); // with plenty of both, cap binds
  });

  it("uses at most one discovery per source question", () => {
    // Two discoveries share q1 — only one of them should appear.
    const pool = [
      ...Array.from({ length: 30 }, (_, i) => cohort(`c${i}`)),
      discovery("d-a", "q1"),
      discovery("d-b", "q1"),
      discovery("d-c", "q2"),
    ];
    const out = sampleCardSquares({ eligible: pool, rng: seededRng(3) });
    const questionIds = out
      .filter((t) => t.kind === "discovery")
      .map((t) => t.question_id);
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it("fills from cohort when discovery pool is smaller than cap", () => {
    const pool = buildPool({
      cohorts: 30,
      discoveries: [
        { id: "d1", qid: "q1" },
        { id: "d2", qid: "q2" },
      ],
    });
    const out = sampleCardSquares({ eligible: pool, rng: seededRng(4) });
    expect(out).toHaveLength(TOTAL_SQUARES);
    expect(out.filter((t) => t.kind === "discovery").length).toBe(2);
    expect(out.filter((t) => t.kind === "cohort").length).toBe(
      TOTAL_SQUARES - 2,
    );
  });

  it("throws when total pool is less than TOTAL_SQUARES", () => {
    const pool = buildPool({
      cohorts: 10,
      discoveries: Array.from({ length: 5 }, (_, i) => ({
        id: `d${i}`,
        qid: `q${i}`,
      })),
    });
    expect(() =>
      sampleCardSquares({ eligible: pool, rng: seededRng(5) }),
    ).toThrow();
  });

  it("produces unique traits (no duplicates)", () => {
    const pool = buildPool({
      cohorts: 40,
      discoveries: Array.from({ length: 15 }, (_, i) => ({
        id: `d${i}`,
        qid: `q${i}`,
      })),
    });
    const out = sampleCardSquares({ eligible: pool, rng: seededRng(6) });
    expect(new Set(out.map((t) => t.id)).size).toBe(out.length);
  });
});

// ─── assembleCardPositions ────────────────────────────────────────────────

describe("assembleCardPositions", () => {
  it("places traits at positions 0..24 skipping 12", () => {
    const traits = Array.from({ length: TOTAL_SQUARES }, (_, i) => cohort(`t${i}`));
    const placed = assembleCardPositions(traits);
    const positions = placed.map((p) => p.position).sort((a, b) => a - b);
    expect(positions).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24,
    ]);
    expect(placed.every((p) => p.trait.id.startsWith("t"))).toBe(true);
  });

  it("rejects wrong-size arrays", () => {
    expect(() => assembleCardPositions([])).toThrow();
    expect(() =>
      assembleCardPositions(Array.from({ length: 23 }, (_, i) => cohort(`t${i}`))),
    ).toThrow();
  });
});

// ─── buildMatcherIndex ────────────────────────────────────────────────────

describe("buildMatcherIndex", () => {
  it("indexes cohort traits by evaluating the match_rule", () => {
    const traits: TraitTemplateRecord[] = [
      {
        id: "t-py",
        question_id: "q-lang",
        kind: "cohort",
        enabled: true,
        match_rule: { op: "eq", value: "Python" },
      },
      {
        id: "t-go",
        question_id: "q-lang",
        kind: "cohort",
        enabled: true,
        match_rule: { op: "eq", value: "Go" },
      },
    ];
    const index = buildMatcherIndex({
      questions: [{ id: "q-lang", type: "single" }],
      traits,
      responses: [
        { player_id: "p1", question_id: "q-lang", value: "Python" },
        { player_id: "p2", question_id: "q-lang", value: "Python" },
        { player_id: "p3", question_id: "q-lang", value: "Go" },
      ],
    });
    expect(Array.from(index.get("t-py") ?? [])).toEqual(["p1", "p2"]);
    expect(Array.from(index.get("t-go") ?? [])).toEqual(["p3"]);
  });

  it("handles multi-select with includes rule", () => {
    const traits: TraitTemplateRecord[] = [
      {
        id: "t-dog",
        question_id: "q-pets",
        kind: "cohort",
        enabled: true,
        match_rule: { op: "includes", value: "Dog" },
      },
    ];
    const index = buildMatcherIndex({
      questions: [{ id: "q-pets", type: "multi" }],
      traits,
      responses: [
        { player_id: "p1", question_id: "q-pets", value: ["Dog", "Cat"] },
        { player_id: "p2", question_id: "q-pets", value: ["Cat"] },
        { player_id: "p3", question_id: "q-pets", value: ["Dog"] },
      ],
    });
    expect(Array.from(index.get("t-dog") ?? []).sort()).toEqual(["p1", "p3"]);
  });

  it("indexes discovery traits by non-empty text answers", () => {
    const traits: TraitTemplateRecord[] = [
      {
        id: "d-hobby",
        question_id: "q-hobby",
        kind: "discovery",
        enabled: true,
        match_rule: null,
      },
    ];
    const index = buildMatcherIndex({
      questions: [{ id: "q-hobby", type: "text" }],
      traits,
      responses: [
        { player_id: "p1", question_id: "q-hobby", value: "chess" },
        { player_id: "p2", question_id: "q-hobby", value: "  " }, // whitespace
        { player_id: "p3", question_id: "q-hobby", value: "unicycle" },
        { player_id: "p4", question_id: "q-hobby", value: "" },
      ],
    });
    expect(Array.from(index.get("d-hobby") ?? []).sort()).toEqual(["p1", "p3"]);
  });

  it("returns an empty set for traits with no matching responses", () => {
    const traits: TraitTemplateRecord[] = [
      {
        id: "t-rust",
        question_id: "q-lang",
        kind: "cohort",
        enabled: true,
        match_rule: { op: "eq", value: "Rust" },
      },
    ];
    const index = buildMatcherIndex({
      questions: [{ id: "q-lang", type: "single" }],
      traits,
      responses: [],
    });
    expect(index.get("t-rust")?.size).toBe(0);
  });
});

describe("constants", () => {
  it("discovery cap is 40% of TOTAL_SQUARES floored", () => {
    expect(DISCOVERY_CAP).toBe(Math.floor(TOTAL_SQUARES * 0.4));
  });
  it("MIN_MATCHERS is 3", () => {
    expect(MIN_MATCHERS).toBe(3);
  });
  it("TOTAL_SQUARES is 24", () => {
    expect(TOTAL_SQUARES).toBe(24);
  });
});
