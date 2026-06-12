// Thin wrapper around thesportsdb.com v1. Server-only — never import from a
// client component. Public test key "3" works without signup; users on
// Patreon ($9/mo) can supply their own dedicated key via SPORTSDB_KEY.
//
// The class, function, and ApiMatch/ApiTeam type names are preserved from
// the previous provider integrations so the rest of the codebase (sync.ts,
// the admin debug endpoint, etc.) doesn't need to care which API is behind
// the lib. Reads strange — sportsdb data passed around as `ApiTeam` /
// `ApiMatch` / `FootballDataError` — but the alternative is a wider rename.

const BASE = "https://www.thesportsdb.com/api/v1/json";

const SPORTSDB_KEY = process.env.SPORTSDB_KEY ?? "3";
// 4429 = FIFA World Cup on thesportsdb. Configurable in case they renumber.
const LEAGUE_ID = Number(process.env.SPORTSDB_LEAGUE_ID ?? 4429);
const SEASON = process.env.SPORTSDB_SEASON ?? "2026";

export type ApiTeam = {
  id: number;
  name: string;
  shortName: string | null;
  // "tla" maps to thesportsdb's strTeamShort (3-letter code) for parity with
  // the old football-data shape that downstream code (flag inference) expects.
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
  minute?: number | null;
  injuryTime?: number | null;
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

type SportsdbEvent = {
  idEvent: string;
  idLeague: string | null;
  strEvent: string | null;
  strSeason: string | null;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  idHomeTeam: string | null;
  idAwayTeam: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
  strProgress: string | null;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  intRound: string | null;
  strRound: string | null;
  strGroup: string | null;
};

async function sdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${SPORTSDB_KEY}${path}`, {
    cache: "no-store",
  });
  if (res.status === 429) {
    throw new FootballDataError(
      "Rate limited by thesportsdb. Back off and try again.",
      429,
      60,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FootballDataError(
      `thesportsdb ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

// thesportsdb status code → the long-form status the rest of the app uses.
function mapStatus(s: string | null): ApiMatch["status"] {
  if (!s) return "TIMED";
  const t = s.toUpperCase();
  switch (t) {
    case "NS":
      return "TIMED";
    case "1H":
    case "2H":
    case "LIVE":
      return "IN_PLAY";
    case "HT":
      return "PAUSED";
    case "ET":
      return "EXTRA_TIME";
    case "PEN":
    case "PSO":
      return "PENALTY_SHOOTOUT";
    case "FT":
    case "AET":
    case "AP":
      return "FINISHED";
    case "POSTP":
    case "POSTPONED":
      return "POSTPONED";
    case "CANC":
    case "CANCELLED":
      return "CANCELLED";
    case "ABD":
    case "SUSP":
      return "SUSPENDED";
    case "AWD":
    case "WO":
      return "AWARDED";
    default:
      return "SCHEDULED";
  }
}

function mapRoundToStage(round: string | null): ApiMatch["stage"] {
  if (!round) return "GROUP_STAGE";
  const r = round.toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter") && !r.includes("3rd"))
    return "FINAL";
  if (r.includes("3rd") || r.includes("third"))
    return "THIRD_PLACE";
  if (r.includes("semi"))
    return "SEMI_FINALS";
  if (r.includes("quarter"))
    return "QUARTER_FINALS";
  if (r.includes("16"))
    return "LAST_16";
  if (r.includes("32"))
    return "LAST_32";
  return "GROUP_STAGE";
}

// thesportsdb sometimes embeds the minute in strProgress (e.g. "45'" or
// "45+2"). Free-tier events usually leave it null though.
function parseMinute(progress: string | null): {
  minute: number | null;
  injury: number | null;
} {
  if (!progress) return { minute: null, injury: null };
  const m = progress.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!m) return { minute: null, injury: null };
  return {
    minute: Number(m[1]),
    injury: m[2] ? Number(m[2]) : null,
  };
}

function utcDateOf(ev: SportsdbEvent): string {
  // thesportsdb stores everything in UTC but strTimestamp ships WITHOUT a
  // TZ marker (e.g. "2026-06-12T19:00:00"). If we hand that to JS Date or
  // Postgres TIMESTAMPTZ as-is, it silently gets treated as local time,
  // which on a UTC+1 (BST) server shifts every kickoff back an hour. Force
  // UTC by appending Z when no offset is already present.
  if (ev.strTimestamp) {
    const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(ev.strTimestamp);
    return hasTz ? ev.strTimestamp : `${ev.strTimestamp}Z`;
  }
  const d = ev.dateEvent ?? "1970-01-01";
  const t = ev.strTime ?? "00:00:00";
  return `${d}T${t}Z`;
}

function toApiMatch(ev: SportsdbEvent): ApiMatch {
  const stage = mapRoundToStage(ev.strRound ?? ev.intRound);
  const home = ev.intHomeScore == null ? null : Number(ev.intHomeScore);
  const away = ev.intAwayScore == null ? null : Number(ev.intAwayScore);
  const { minute, injury } = parseMinute(ev.strProgress);
  return {
    id: Number(ev.idEvent),
    utcDate: utcDateOf(ev),
    status: mapStatus(ev.strStatus),
    matchday: ev.intRound ? Number(ev.intRound) : null,
    minute,
    injuryTime: injury,
    stage,
    group: ev.strGroup ?? null,
    homeTeam: {
      id: ev.idHomeTeam ? Number(ev.idHomeTeam) : null,
      name: ev.strHomeTeam,
      tla: null,
    },
    awayTeam: {
      id: ev.idAwayTeam ? Number(ev.idAwayTeam) : null,
      name: ev.strAwayTeam,
      tla: null,
    },
    score: {
      winner: null,
      duration: "REGULAR",
      fullTime: { home, away },
      halfTime: { home: null, away: null },
    },
  };
}

// thesportsdb's /lookup_all_teams.php endpoint returns wrong data for
// international tournaments — for league 4429 it serves English lower-
// division clubs (Wigan, Blackpool, etc.), nothing related to the WC.
// We derive the team list from /eventsseason.php events instead, where the
// home/away team IDs ARE the real qualifying nations.
//
// Exposed separately so runFixturesSync can still call fetchWcTeams() +
// fetchWcMatches() back-to-back without changing its shape, but both end
// up hitting the same single endpoint behind the scenes.
let cachedSeasonEvents: { at: number; events: SportsdbEvent[] } | null = null;
const SEASON_CACHE_MS = 30_000;

async function getSeasonEvents(): Promise<SportsdbEvent[]> {
  if (cachedSeasonEvents && Date.now() - cachedSeasonEvents.at < SEASON_CACHE_MS) {
    return cachedSeasonEvents.events;
  }
  const json = await sdbFetch<{ events: SportsdbEvent[] | null }>(
    `/eventsseason.php?id=${LEAGUE_ID}&s=${SEASON}`,
  );
  const events = json.events ?? [];
  cachedSeasonEvents = { at: Date.now(), events };
  return events;
}

export async function fetchWcTeams(): Promise<ApiTeam[]> {
  const events = await getSeasonEvents();
  const seen = new Map<number, ApiTeam>();
  for (const ev of events) {
    for (const side of [
      { id: ev.idHomeTeam, name: ev.strHomeTeam },
      { id: ev.idAwayTeam, name: ev.strAwayTeam },
    ]) {
      if (!side.id || !side.name) continue;
      const id = Number(side.id);
      if (seen.has(id)) continue;
      seen.set(id, {
        id,
        name: side.name,
        shortName: side.name,
        tla: null,
        crest: null,
      });
    }
  }
  return Array.from(seen.values());
}

export async function fetchWcMatches(
  _opts: { dateFrom?: string; dateTo?: string } = {},
): Promise<ApiMatch[]> {
  const events = await getSeasonEvents();
  return events.map(toApiMatch);
}

// Live-only polling: re-uses the same /eventsseason.php response as
// fetchWcMatches, going through the same 30-second cache.
//
// Originally we used /eventsday.php?d=<today>&s=Soccer to fetch only today's
// games. That works for some WC dates (Mexico vs South Africa on 2026-06-11
// showed up fine) but silently drops others (South Korea vs Czech Republic on
// 2026-06-12 doesn't appear there despite dateEvent + idLeague being correct
// — it only shows up via /eventsseason). Going through the season endpoint
// gives us a single source of truth across all matches; the payload is small
// (≤104 events for the whole tournament) and the cache absorbs repeated
// calls inside one sync run.
export async function fetchLiveWcMatches(): Promise<ApiMatch[]> {
  const events = await getSeasonEvents();
  return events.map(toApiMatch);
}

export function mapGroupLetter(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/([A-L])$/i);
  return m ? m[1].toUpperCase() : null;
}

export function mapStage(apiStage: ApiMatch["stage"]): string {
  const m: Record<ApiMatch["stage"], string> = {
    GROUP_STAGE: "group",
    LAST_32: "r32",
    LAST_16: "r16",
    QUARTER_FINALS: "qf",
    SEMI_FINALS: "sf",
    THIRD_PLACE: "third",
    FINAL: "final",
  };
  return m[apiStage];
}

export function normalizeTeamName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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
