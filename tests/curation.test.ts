import { describe, expect, it } from "vitest";
import {
  MIN_MATCHERS,
  bucketCounts,
  cohortMatchersForRule,
  discoveryAnswerCount,
  nonEmptyTextAnswers,
} from "@/lib/curation";

describe("bucketCounts", () => {
  it("counts single-select by value", () => {
    const c = bucketCounts("single", ["Python", "Go", "Python", "Rust"]);
    expect(c).toEqual({ Python: 2, Go: 1, Rust: 1 });
  });

  it("counts binary and numeric_bucket the same way", () => {
    expect(bucketCounts("binary", ["Tabs", "Spaces", "Tabs"])).toEqual({
      Tabs: 2,
      Spaces: 1,
    });
    expect(bucketCounts("numeric_bucket", ["0–2", "10+", "10+", "3–5"])).toEqual(
      { "0–2": 1, "10+": 2, "3–5": 1 },
    );
  });

  it("expands multi-select values into per-option counts", () => {
    const c = bucketCounts("multi", [["Dog", "Cat"], ["Dog"], ["Bird"]]);
    expect(c).toEqual({ Dog: 2, Cat: 1, Bird: 1 });
  });

  it("ignores nulls, empty strings, and wrong shapes", () => {
    expect(
      bucketCounts("single", [null, "", "Python", [] as unknown as string]),
    ).toEqual({ Python: 1 });
    expect(
      bucketCounts("multi", [null, "notArray" as unknown as string[], ["Dog"]]),
    ).toEqual({ Dog: 1 });
  });
});

describe("discoveryAnswerCount / nonEmptyTextAnswers", () => {
  it("counts only non-empty trimmed strings", () => {
    const rs = ["chess", "  ", "", null, "unicycle", ["not", "text"]];
    expect(discoveryAnswerCount(rs)).toBe(2);
    expect(nonEmptyTextAnswers(rs)).toEqual(["chess", "unicycle"]);
  });
});

describe("cohortMatchersForRule", () => {
  it("looks up eq rule in the counts map", () => {
    const counts = { Python: 5, Go: 2 };
    expect(
      cohortMatchersForRule("single", { op: "eq", value: "Python" }, counts),
    ).toBe(5);
    expect(
      cohortMatchersForRule("single", { op: "eq", value: "Rust" }, counts),
    ).toBe(0);
  });

  it("looks up includes rule the same way", () => {
    const counts = { Dog: 3, Cat: 1 };
    expect(
      cohortMatchersForRule("multi", { op: "includes", value: "Dog" }, counts),
    ).toBe(3);
  });
});

describe("MIN_MATCHERS", () => {
  it("is 3", () => {
    expect(MIN_MATCHERS).toBe(3);
  });
});
