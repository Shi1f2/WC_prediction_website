// Pure scoring helpers. No DB / Node imports — safe for client components.

export const POINTS = {
  exactScore: 5,
  goalDiffAndWinner: 3,
  winnerOnly: 2,
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
  if (pa === aa && pb === ab) return POINTS.exactScore;
  const pDiff = pa - pb;
  const aDiff = aa - ab;
  const pWinner = Math.sign(pDiff);
  const aWinner = Math.sign(aDiff);
  if (pWinner !== aWinner) return 0;
  if (pDiff === aDiff) return POINTS.goalDiffAndWinner;
  return POINTS.winnerOnly;
}
