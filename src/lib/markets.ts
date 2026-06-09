// Pure helpers. No DB / Node imports — safe for client components.

export type MarketOption = {
  value: string;
  label: string;
  points: number;
};

export type MarketDef = {
  id: string;
  label: string;
  short: string;
  options: MarketOption[];
};

// Edit this list to add/remove markets — no migration needed.
// `id` and option `value` are persisted in match_market_predictions; don't
// rename them after launch or old picks won't grade correctly.
export const MARKETS: MarketDef[] = [
  {
    id: "ou_15",
    label: "Total goals — Over / Under 1.5",
    short: "O/U 1.5",
    options: [
      { value: "over", label: "Over 1.5", points: 3 },
      { value: "under", label: "Under 1.5", points: 3 },
    ],
  },
  {
    id: "ou_25",
    label: "Total goals — Over / Under 2.5",
    short: "O/U 2.5",
    options: [
      { value: "over", label: "Over 2.5", points: 4 },
      { value: "under", label: "Under 2.5", points: 4 },
    ],
  },
  {
    id: "ou_35",
    label: "Total goals — Over / Under 3.5",
    short: "O/U 3.5",
    options: [
      { value: "over", label: "Over 3.5", points: 6 },
      { value: "under", label: "Under 3.5", points: 6 },
    ],
  },
  {
    id: "btts",
    label: "Both teams to score",
    short: "BTTS",
    options: [
      { value: "yes", label: "Yes", points: 4 },
      { value: "no", label: "No", points: 4 },
    ],
  },
  {
    id: "margin",
    label: "Winning margin",
    short: "Margin",
    options: [
      { value: "draw", label: "Draw", points: 5 },
      { value: "a_by_1", label: "A by 1", points: 6 },
      { value: "a_by_2", label: "A by 2", points: 8 },
      { value: "a_by_3plus", label: "A by 3+", points: 10 },
      { value: "b_by_1", label: "B by 1", points: 6 },
      { value: "b_by_2", label: "B by 2", points: 8 },
      { value: "b_by_3plus", label: "B by 3+", points: 10 },
    ],
  },
];

export const MARKET_BY_ID: Record<string, MarketDef> = Object.fromEntries(
  MARKETS.map((m) => [m.id, m]),
);

export function isValidMarketPick(marketId: string, pick: string): boolean {
  const m = MARKET_BY_ID[marketId];
  if (!m) return false;
  return m.options.some((o) => o.value === pick);
}

// Returns the winning option value for a market given a final score, or null
// if the market id is unknown.
export function correctPick(
  marketId: string,
  scoreA: number,
  scoreB: number,
): string | null {
  const total = scoreA + scoreB;
  switch (marketId) {
    case "ou_15":
      return total > 1.5 ? "over" : "under";
    case "ou_25":
      return total > 2.5 ? "over" : "under";
    case "ou_35":
      return total > 3.5 ? "over" : "under";
    case "btts":
      return scoreA > 0 && scoreB > 0 ? "yes" : "no";
    case "margin": {
      const diff = scoreA - scoreB;
      if (diff === 0) return "draw";
      const side = diff > 0 ? "a" : "b";
      const ad = Math.abs(diff);
      if (ad === 1) return `${side}_by_1`;
      if (ad === 2) return `${side}_by_2`;
      return `${side}_by_3plus`;
    }
    default:
      return null;
  }
}

// Symmetric scoring: correct pick wins `points`, wrong pick loses `points`.
// Skipping a market is neutral (no row in the table → not counted).
export function gradeMarket(
  marketId: string,
  pick: string,
  scoreA: number,
  scoreB: number,
): number {
  const correct = correctPick(marketId, scoreA, scoreB);
  if (correct == null) return 0;
  const m = MARKET_BY_ID[marketId];
  if (!m) return 0;
  const opt = m.options.find((o) => o.value === pick);
  if (!opt) return 0;
  return correct === pick ? opt.points : -opt.points;
}

export function pointsFor(marketId: string, pick: string): number {
  const m = MARKET_BY_ID[marketId];
  if (!m) return 0;
  return m.options.find((o) => o.value === pick)?.points ?? 0;
}
