// Pure scan-eligibility computation. Given a scanner's card squares, their
// existing claims, and the scanned player's materialized trait set, return
// the set of tile positions the scanner could claim from this scan.
//
// Reuse-unlock semantics:
//   - `reuseUnlocked = false` (default): if the scanner already claimed any
//     square via this teammate, the whole scan is a no-op (alreadyUsed).
//   - `reuseUnlocked = true`: duplicates are allowed; same computation just
//     without the whole-teammate-spent early-exit.

export type CardSquareInfo = {
  position: number;
  traitTemplateId: string | null; // null for free space
};

export type ClaimInfo = {
  position: number;
  viaPlayerId: string;
};

export type ScanEligibility =
  | { kind: "eligible"; positions: number[] }
  | { kind: "already_used" }
  | { kind: "none" };

export function computeScanEligibility({
  scannerSquares,
  scannerClaims,
  scannedPlayerId,
  scannedPlayerTraitIds,
  reuseUnlocked,
}: {
  scannerSquares: CardSquareInfo[];
  scannerClaims: ClaimInfo[];
  scannedPlayerId: string;
  scannedPlayerTraitIds: Set<string>;
  reuseUnlocked: boolean;
}): ScanEligibility {
  if (
    !reuseUnlocked &&
    scannerClaims.some((c) => c.viaPlayerId === scannedPlayerId)
  ) {
    return { kind: "already_used" };
  }

  const claimedPositions = new Set(scannerClaims.map((c) => c.position));
  const positions: number[] = [];
  for (const s of scannerSquares) {
    if (s.traitTemplateId == null) continue; // free space
    if (claimedPositions.has(s.position)) continue;
    if (!scannedPlayerTraitIds.has(s.traitTemplateId)) continue;
    positions.push(s.position);
  }
  if (positions.length === 0) return { kind: "none" };
  return { kind: "eligible", positions };
}
