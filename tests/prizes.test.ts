import { describe, expect, it } from "vitest";
import {
  completeLines,
  isBlackout,
  mostBingosWinners,
  unluckiestWinners,
} from "@/lib/prizes";

describe("completeLines", () => {
  it("finds no lines on an empty board", () => {
    expect(completeLines(new Set())).toEqual([]);
  });

  it("detects row 0 with free space implicit", () => {
    // Row 0 = 0..4 — none include free. Need all 5.
    const s = new Set([0, 1, 2, 3, 4]);
    expect(completeLines(s)).toEqual([{ line_type: "row", line_index: 0 }]);
  });

  it("detects row 2 using the free space", () => {
    // Row 2 includes position 12 (free). Caller only supplies non-free.
    const s = new Set([10, 11, 13, 14]);
    expect(completeLines(s)).toEqual([{ line_type: "row", line_index: 2 }]);
  });

  it("detects a column", () => {
    const s = new Set([2, 7, 17, 22]); // 12 is free
    expect(completeLines(s)).toEqual([{ line_type: "col", line_index: 2 }]);
  });

  it("detects both diagonals", () => {
    const s = new Set([0, 6, 18, 24, 4, 8, 16, 20]);
    const lines = completeLines(s);
    expect(lines).toContainEqual({ line_type: "diag", line_index: 0 });
    expect(lines).toContainEqual({ line_type: "diag", line_index: 1 });
  });

  it("detects a claim that simultaneously completes a row and a column", () => {
    // Claim 14 completes row 2 (10,11,13,14 + free) AND col 4 (4,9,19,24 + 14)
    const s = new Set([10, 11, 13, 14, 4, 9, 19, 24]);
    const lines = completeLines(s);
    expect(lines).toContainEqual({ line_type: "row", line_index: 2 });
    expect(lines).toContainEqual({ line_type: "col", line_index: 4 });
  });
});

describe("isBlackout", () => {
  it("is false for an empty board", () => {
    expect(isBlackout(new Set())).toBe(false);
  });

  it("is false with 23 non-free claimed", () => {
    const s = new Set<number>();
    for (let i = 0; i < 24; i++) {
      if (i === 12) continue;
      s.add(i < 12 ? i : i + 1);
    }
    s.delete(24);
    expect(isBlackout(s)).toBe(false);
  });

  it("is true with all 24 non-free claimed", () => {
    const s = new Set<number>();
    for (let i = 0; i <= 24; i++) {
      if (i === 12) continue;
      s.add(i);
    }
    expect(isBlackout(s)).toBe(true);
  });

  it("ignores the free position if caller mistakenly includes it", () => {
    const s = new Set<number>([12]);
    expect(isBlackout(s)).toBe(false);
  });
});

describe("mostBingosWinners", () => {
  it("returns no winners when nobody bingo'd", () => {
    expect(
      mostBingosWinners([
        { playerId: "A", bingoCount: 0 },
        { playerId: "B", bingoCount: 0 },
      ]),
    ).toEqual([]);
  });

  it("picks the player with the highest bingo count", () => {
    const winners = mostBingosWinners([
      { playerId: "A", bingoCount: 1 },
      { playerId: "B", bingoCount: 4 },
      { playerId: "C", bingoCount: 2 },
    ]);
    expect(winners).toEqual([{ playerId: "B", bingoCount: 4 }]);
  });

  it("shares the prize on ties at the top count", () => {
    const winners = mostBingosWinners([
      { playerId: "A", bingoCount: 3 },
      { playerId: "B", bingoCount: 3 },
      { playerId: "C", bingoCount: 1 },
    ]);
    expect(winners).toHaveLength(2);
    expect(winners).toContainEqual({ playerId: "A", bingoCount: 3 });
    expect(winners).toContainEqual({ playerId: "B", bingoCount: 3 });
  });

  it("excludes zero-bingo players even when others tie at zero", () => {
    const winners = mostBingosWinners([
      { playerId: "A", bingoCount: 0 },
      { playerId: "B", bingoCount: 2 },
      { playerId: "C", bingoCount: 0 },
    ]);
    expect(winners).toEqual([{ playerId: "B", bingoCount: 2 }]);
  });
});

describe("unluckiestWinners", () => {
  it("picks the highest claims-to-bingo count", () => {
    const winners = unluckiestWinners([
      { playerId: "A", claimsToBingo: 5 },
      { playerId: "B", claimsToBingo: 14 },
      { playerId: "C", claimsToBingo: 3 },
    ]);
    expect(winners).toEqual([{ playerId: "B", claimsToBingo: 14 }]);
  });

  it("non-bingoer with 20 total claims beats bingoer with 14 claims-to-bingo", () => {
    // Caller provides the unified metric; helper doesn't know the difference.
    const winners = unluckiestWinners([
      { playerId: "bingoer", claimsToBingo: 14 },
      { playerId: "nonBingoer", claimsToBingo: 20 },
    ]);
    expect(winners).toEqual([{ playerId: "nonBingoer", claimsToBingo: 20 }]);
  });

  it("shares on ties", () => {
    const winners = unluckiestWinners([
      { playerId: "A", claimsToBingo: 10 },
      { playerId: "B", claimsToBingo: 10 },
      { playerId: "C", claimsToBingo: 5 },
    ]);
    expect(winners).toHaveLength(2);
  });

  it("excludes players who made zero claims", () => {
    const winners = unluckiestWinners([
      { playerId: "A", claimsToBingo: 0 },
      { playerId: "B", claimsToBingo: 3 },
    ]);
    expect(winners).toEqual([{ playerId: "B", claimsToBingo: 3 }]);
  });

  it("returns empty when no one played", () => {
    expect(
      unluckiestWinners([
        { playerId: "A", claimsToBingo: 0 },
        { playerId: "B", claimsToBingo: 0 },
      ]),
    ).toEqual([]);
  });
});
