import { describe, expect, it } from "vitest";
import { seedsForQuestion } from "@/lib/traits";

describe("seedsForQuestion", () => {
  it("emits one discovery seed for text questions", () => {
    const seeds = seedsForQuestion("text", "What's your hobby?", null);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].kind).toBe("discovery");
    expect(seeds[0].match_rule).toBeNull();
    expect(seeds[0].conversation_prompt).toBeNull();
    expect(seeds[0].square_text.length).toBeLessThanOrEqual(36);
  });

  it("emits one cohort seed per option for single-select", () => {
    const seeds = seedsForQuestion("single", "First language?", [
      "Python",
      "Go",
      "Rust",
    ]);
    expect(seeds).toHaveLength(3);
    for (const s of seeds) {
      expect(s.kind).toBe("cohort");
      expect(s.match_rule?.op).toBe("eq");
      expect(s.square_text.length).toBeLessThanOrEqual(36);
      expect(s.conversation_prompt).not.toBeNull();
    }
    expect(seeds.map((s) => s.match_rule?.value)).toEqual([
      "Python",
      "Go",
      "Rust",
    ]);
  });

  it("uses includes op for multi-select", () => {
    const seeds = seedsForQuestion("multi", "Pets?", ["Dog", "Cat"]);
    expect(seeds).toHaveLength(2);
    for (const s of seeds) expect(s.match_rule?.op).toBe("includes");
  });

  it("uses eq op for binary and numeric_bucket", () => {
    const bin = seedsForQuestion("binary", "Tabs or spaces?", [
      "Tabs",
      "Spaces",
    ]);
    for (const s of bin) expect(s.match_rule?.op).toBe("eq");

    const num = seedsForQuestion("numeric_bucket", "Years coding?", [
      "0–2",
      "3–5",
      "10+",
    ]);
    for (const s of num) expect(s.match_rule?.op).toBe("eq");
  });

  it("emits zero seeds when non-text question is missing options", () => {
    expect(seedsForQuestion("single", "unused", null)).toEqual([]);
    expect(seedsForQuestion("multi", "unused", [])).toEqual([]);
  });

  it("clips square_text to 36 chars", () => {
    const long = "a".repeat(200);
    const seeds = seedsForQuestion("single", "Q?", [long]);
    expect(seeds[0].square_text.length).toBe(36);
  });
});
