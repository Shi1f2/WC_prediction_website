// Thin wrapper around football-data.org v4. Server-only — never import from a
// client component. Free tier is 10 req/min; we surface the throttle headers
// so callers can show meaningful errors instead of opaque 429s.

const BASE = "https://api.football-data.org/v4";
const WC_CODE = "WC";

export type ApiTeam = {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
};

export type ApiMatch = {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "EXTRA_TIME"
    | "PENALTY_SHOOTOUT"
    | "FINISHED"
    | "SUSPENDED"
    | "POSTPONED"
    | "CANCELLED"
    | "AWARDED";
  matchday: number | null;
  stage:
    | "GROUP_STAGE"
    | "LAST_32"
    | "LAST_16"
    | "QUARTER_FINALS"
    | "SEMI_FINALS"
    | "THIRD_PLACE"
    | "FINAL";
  group: string | null;
  homeTeam: { id: number | null; name: string | null; tla: string | null };
  awayTeam: { id: number | null; name: string | null; tla: string | null };
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
};

export class FootballDataError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function fdFetch<T>(path: string): Promise<T> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token)
    throw new FootballDataError("FOOTBALL_DATA_TOKEN not set", 500);

  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });

  if (res.status === 429) {
    const reset = Number(res.headers.get("X-RequestCounter-Reset") ?? "60");
    throw new FootballDataError(
      `Rate limited by football-data.org. Try again in ${reset}s.`,
      429,
      reset,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FootballDataError(
      `football-data.org ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export async function fetchWcTeams(): Promise<ApiTeam[]> {
  const data = await fdFetch<{ teams: ApiTeam[] }>(
    `/competitions/${WC_CODE}/teams`,
  );
  return data.teams ?? [];
}

// dateFrom/dateTo are required — the no-filter call returns 0 results for WC.
export async function fetchWcMatches(
  opts: { dateFrom?: string; dateTo?: string } = {},
): Promise<ApiMatch[]> {
  const from = opts.dateFrom ?? "2026-06-01";
  const to = opts.dateTo ?? "2026-07-31";
  const data = await fdFetch<{ matches: ApiMatch[] }>(
    `/competitions/${WC_CODE}/matches?dateFrom=${from}&dateTo=${to}`,
  );
  return data.matches ?? [];
}

const STAGE_MAP: Record<ApiMatch["stage"], string> = {
  GROUP_STAGE: "group",
  LAST_32: "r32",
  LAST_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  THIRD_PLACE: "third",
  FINAL: "final",
};

export function mapStage(apiStage: ApiMatch["stage"]): string {
  return STAGE_MAP[apiStage];
}

export function mapGroupLetter(apiGroup: string | null): string | null {
  if (!apiGroup) return null;
  const m = apiGroup.match(/^GROUP_([A-L])$/);
  return m ? m[1] : null;
}

// Strip accents, lowercase, collapse punctuation, drop common prefixes so
// "Côte d'Ivoire" and "Cote dIvoire" hash the same.
export function normalizeTeamName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Known aliases between the API and our seed. Extend as needed.
const NAME_ALIASES: Record<string, string[]> = {
  "united states": ["usa", "us", "united states of america"],
  "south korea": ["korea republic", "republic of korea", "korea south"],
  "ivory coast": ["cote d ivoire", "cote divoire", "côte d ivoire"],
  "czechia": ["czech republic"],
  "turkey": ["turkiye", "turkey turkiye", "türkiye"],
  "congo dr": ["dr congo", "democratic republic of congo", "drc"],
  "bosnia herzegovina": [
    "bosnia and herzegovina",
    "bih",
    "bosnia herzegovina",
  ],
  "cape verde": ["cabo verde", "cape verde islands"],
  "south africa": ["rsa", "republic of south africa"],
  "saudi arabia": ["ksa", "saudi"],
  "new zealand": ["nzl", "all whites"],
  "curacao": ["curaçao"],
  "haiti": ["haïti"],
};

export function teamNameMatches(apiName: string, dbName: string): boolean {
  const a = normalizeTeamName(apiName);
  const b = normalizeTeamName(dbName);
  if (a === b) return true;
  for (const [canon, aliases] of Object.entries(NAME_ALIASES)) {
    const group = [canon, ...aliases];
    if (group.includes(a) && group.includes(b)) return true;
  }
  return false;
}
