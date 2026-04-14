import { describe, expect, it } from "vitest";
import { generate96BitToken, generateEventCode } from "@/lib/ids";

describe("generateEventCode", () => {
  it("returns requested length", () => {
    expect(generateEventCode(5)).toHaveLength(5);
    expect(generateEventCode(8)).toHaveLength(8);
  });

  it("uses only non-confusable alphanumerics", () => {
    const code = generateEventCode(200);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    // explicit: no confusables 0/O/1/I/L
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("produces distinct codes across calls (effectively)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateEventCode(6));
    expect(seen.size).toBeGreaterThan(195);
  });
});

describe("generate96BitToken", () => {
  it("returns a url-safe base64 string of the right length", () => {
    const t = generate96BitToken();
    // 12 bytes base64url-encoded = 16 chars, no padding
    expect(t).toHaveLength(16);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is non-repeating across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generate96BitToken());
    expect(seen.size).toBe(1000);
  });
});
