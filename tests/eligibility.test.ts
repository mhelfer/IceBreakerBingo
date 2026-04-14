import { describe, expect, it } from "vitest";
import { computeScanEligibility } from "@/lib/eligibility";

const squares = [
  { position: 0, traitTemplateId: "t1" },
  { position: 1, traitTemplateId: "t2" },
  { position: 2, traitTemplateId: "t3" },
  { position: 12, traitTemplateId: null }, // free
  { position: 13, traitTemplateId: "t4" },
];

describe("computeScanEligibility", () => {
  it("returns positions whose trait the scanned player matches", () => {
    const r = computeScanEligibility({
      scannerSquares: squares,
      scannerClaims: [],
      scannedPlayerId: "B",
      scannedPlayerTraitIds: new Set(["t1", "t3"]),
      reuseUnlocked: false,
    });
    expect(r).toEqual({ kind: "eligible", positions: [0, 2] });
  });

  it("skips squares the scanner already claimed", () => {
    const r = computeScanEligibility({
      scannerSquares: squares,
      scannerClaims: [{ position: 0, viaPlayerId: "C" }],
      scannedPlayerId: "B",
      scannedPlayerTraitIds: new Set(["t1", "t3"]),
      reuseUnlocked: false,
    });
    expect(r).toEqual({ kind: "eligible", positions: [2] });
  });

  it("returns already_used when teammate already spent on this card pre-unlock", () => {
    const r = computeScanEligibility({
      scannerSquares: squares,
      scannerClaims: [{ position: 0, viaPlayerId: "B" }],
      scannedPlayerId: "B",
      scannedPlayerTraitIds: new Set(["t1", "t3"]),
      reuseUnlocked: false,
    });
    expect(r).toEqual({ kind: "already_used" });
  });

  it("allows duplicates when reuse unlocked", () => {
    const r = computeScanEligibility({
      scannerSquares: squares,
      scannerClaims: [{ position: 0, viaPlayerId: "B" }],
      scannedPlayerId: "B",
      scannedPlayerTraitIds: new Set(["t1", "t3"]),
      reuseUnlocked: true,
    });
    // position 0 still filtered because claimed; position 2 still eligible.
    expect(r).toEqual({ kind: "eligible", positions: [2] });
  });

  it("returns none when no traits match", () => {
    const r = computeScanEligibility({
      scannerSquares: squares,
      scannerClaims: [],
      scannedPlayerId: "B",
      scannedPlayerTraitIds: new Set(["tX"]),
      reuseUnlocked: false,
    });
    expect(r).toEqual({ kind: "none" });
  });

  it("never returns the free space", () => {
    const r = computeScanEligibility({
      scannerSquares: squares,
      scannerClaims: [],
      scannedPlayerId: "B",
      // Can't happen in practice (free has null trait_template_id) but guard.
      scannedPlayerTraitIds: new Set(),
      reuseUnlocked: false,
    });
    expect(r).toEqual({ kind: "none" });
  });
});
