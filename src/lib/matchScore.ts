// Pure scoring helpers. No DB / Node imports — safe for client components.

export const POINTS = {
  exactScore: 10,
  exactScoreWrong: -10,
  // Kept for the group/bracket scoring that still uses these names; the per-tier
  // partial credit (goalDiffAndWinner / winnerOnly) is no longer applied to
  // match scores — only an exact match wins, anything else loses.
  goalDiffAndWinner: 0,
  winnerOnly: 0,
  groupPositionExact: 4,
  groupTopTwoAnyOrder: 2,
  bracket: {
    R16: 1,
    QF: 2,
    SF: 4,
    FINAL: 8,
    WINNER: 16,
  },
} as const;

export function scoreMatch(
  pa: number,
  pb: number,
  aa: number,
  ab: number,
): number {
  return pa === aa && pb === ab ? POINTS.exactScore : POINTS.exactScoreWrong;
}
