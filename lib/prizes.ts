// Pure bingo + prize detection helpers. No Supabase, no network, no time.
//
// Board is 5×5, positions 0..24, row-major. Center (position 12) is free
// and always counts as claimed.
//
// Lines:
//   rows      0 → {0..4}       1 → {5..9}   2 → {10..14}   3 → {15..19}   4 → {20..24}
//   cols      0 → {0,5,10,15,20} … 4 → {4,9,14,19,24}
//   diags     0 → {0,6,12,18,24}   1 → {4,8,12,16,20}
//
// `positions` is the set of *non-free* claimed positions — callers should
// not include 12 (we treat it as always-claimed internally).

export const FREE_POSITION = 12;
export const TOTAL_NON_FREE = 24;

export type BingoLineType = "row" | "col" | "diag";
export type CompleteLine = { line_type: BingoLineType; line_index: number };

const ROWS: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
];
const COLS: number[][] = [
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
];
const DIAGS: number[][] = [
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

function isComplete(line: number[], claimed: Set<number>): boolean {
  for (const p of line) {
    if (p === FREE_POSITION) continue;
    if (!claimed.has(p)) return false;
  }
  return true;
}

export function completeLines(positions: Set<number>): CompleteLine[] {
  const out: CompleteLine[] = [];
  for (let i = 0; i < ROWS.length; i++) {
    if (isComplete(ROWS[i], positions)) out.push({ line_type: "row", line_index: i });
  }
  for (let i = 0; i < COLS.length; i++) {
    if (isComplete(COLS[i], positions)) out.push({ line_type: "col", line_index: i });
  }
  for (let i = 0; i < DIAGS.length; i++) {
    if (isComplete(DIAGS[i], positions)) out.push({ line_type: "diag", line_index: i });
  }
  return out;
}

export function isBlackout(positions: Set<number>): boolean {
  let n = 0;
  for (const p of positions) {
    if (p === FREE_POSITION) continue;
    if (p < 0 || p > 24) continue;
    n++;
  }
  return n >= TOTAL_NON_FREE;
}

// ─── end-of-game metrics ────────────────────────────────────────────────

// Most Bingos: highest count of completed bingo lines per player. Ties
// share. Players with zero bingos are excluded.
export type PlayerBingoCount = {
  playerId: string;
  bingoCount: number;
};

export function mostBingosWinners(
  players: PlayerBingoCount[],
): { playerId: string; bingoCount: number }[] {
  const eligible = players.filter((p) => p.bingoCount > 0);
  if (eligible.length === 0) return [];
  const max = Math.max(...eligible.map((p) => p.bingoCount));
  return eligible
    .filter((p) => p.bingoCount === max)
    .map((p) => ({ playerId: p.playerId, bingoCount: p.bingoCount }));
}

// Unluckiest: highest claims-to-bingo. Bingoers use claims up to and
// including their first bingo; non-bingoers use their total claim count.
// Highest value wins; ties share. Players with zero claims are excluded
// so "never scanned anything" doesn't win by having 0 > all bingoers —
// a player has to have actually played.
export type PlayerClaimsToBingo = {
  playerId: string;
  claimsToBingo: number; // count per the rule above; 0 means didn't play
};

export function unluckiestWinners(
  players: PlayerClaimsToBingo[],
): { playerId: string; claimsToBingo: number }[] {
  const eligible = players.filter((p) => p.claimsToBingo > 0);
  if (eligible.length === 0) return [];
  const max = Math.max(...eligible.map((p) => p.claimsToBingo));
  return eligible
    .filter((p) => p.claimsToBingo === max)
    .map((p) => ({ playerId: p.playerId, claimsToBingo: p.claimsToBingo }));
}
