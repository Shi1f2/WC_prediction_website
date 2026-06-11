// Score-only sync.
//
// We don't sync teams or insert new matches anymore — the seed file owns the
// 48 WC team rows and the 104 fixtures, and the admin can hand-edit anything
// else. All this module does is: pull live event scores from thesportsdb,
// match them against existing match rows by (team-A name, team-B name, kickoff
// date), and UPDATE the score/status/minute. Rows with manual_override = TRUE
// are never touched.

import { sql } from "@/lib/db";
import {
  fetchLiveWcMatches,
  fetchWcMatches,
  teamNameMatches,
  type ApiMatch,
} from "@/lib/footballData";

// Report shapes preserved so AdminSync.tsx can keep rendering them as-is. The
// team counters always come back as zero; the matches counters carry the
// actual story.
export type TeamSyncReport = {
  api_count: number;
  inserted: number;
  linked: number;
  updated: number;
  orphans: { id: number; name: string; group_letter: string | null }[];
};

export type FixturesSyncReport = {
  teams: TeamSyncReport;
  matches: {
    api_count: number;
    inserted: number;
    updated: number;
    skipped: { api_id: number; reason: string }[];
  };
};

export type ResultsSyncReport = {
  api_count: number;
  updated: number;
  unchanged: number;
  not_linked: number[];
};

const EMPTY_TEAM_REPORT: TeamSyncReport = {
  api_count: 0,
  inserted: 0,
  linked: 0,
  updated: 0,
  orphans: [],
};

type SyncOutcome = {
  apiCount: number;
  updated: number;
  unchanged: number;
  // API event ids that didn't match any DB row by name+date.
  unmatched: { api_id: number; home: string; away: string }[];
};

const LIVE_OR_DONE_STATUSES = new Set([
  "FINISHED",
  "AWARDED",
  "IN_PLAY",
  "PAUSED",
  "EXTRA_TIME",
  "PENALTY_SHOOTOUT",
]);
const IN_PLAY_STATUSES = new Set(["IN_PLAY", "EXTRA_TIME"]);

// Workhorse — called by both fixtures and results entry points with a
// different fetcher (whole season vs. today only).
async function syncScores(
  fetcher: () => Promise<ApiMatch[]>,
): Promise<SyncOutcome> {
  const apiMatches = await fetcher();

  // Pre-fetch all existing matches with their team names + kickoff. One bulk
  // SELECT, then everything else is in-memory matching.
  const dbMatches = await sql<
    {
      id: number;
      kickoff_at: Date;
      team_a_name: string | null;
      team_b_name: string | null;
      manual_override: boolean;
    }[]
  >`
    SELECT m.id, m.kickoff_at,
           ta.name AS team_a_name, tb.name AS team_b_name,
           m.manual_override
    FROM matches m
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
  `;

  // Pre-bucket DB matches by kickoff date (UTC) so each event only scans a
  // small list. With 104 matches across ~30 days that's ~3-4 per day.
  const dbByDate = new Map<
    string,
    (typeof dbMatches)[number][]
  >();
  for (const m of dbMatches) {
    const day = m.kickoff_at.toISOString().slice(0, 10);
    let arr = dbByDate.get(day);
    if (!arr) {
      arr = [];
      dbByDate.set(day, arr);
    }
    arr.push(m);
  }

  type UpdatePlan = {
    id: number;
    am: ApiMatch;
    scoreA: number | null;
    scoreB: number | null;
    currentMinute: number | null;
    injuryTime: number | null;
  };
  const updates: UpdatePlan[] = [];
  const unmatched: SyncOutcome["unmatched"] = [];
  let unchanged = 0;

  for (const am of apiMatches) {
    const home = am.homeTeam.name;
    const away = am.awayTeam.name;
    if (!home || !away) continue;

    const apiDay = am.utcDate.slice(0, 10);
    const candidates = dbByDate.get(apiDay) ?? [];
    const matched = candidates.find(
      (m) =>
        m.team_a_name != null &&
        m.team_b_name != null &&
        teamNameMatches(home, m.team_a_name) &&
        teamNameMatches(away, m.team_b_name),
    );

    if (!matched) {
      unmatched.push({ api_id: am.id, home, away });
      continue;
    }
    if (matched.manual_override) {
      unchanged++;
      continue;
    }

    const liveOrDone = LIVE_OR_DONE_STATUSES.has(am.status);
    const scoreA = liveOrDone ? am.score.fullTime.home : null;
    const scoreB = liveOrDone ? am.score.fullTime.away : null;
    const isInPlay = IN_PLAY_STATUSES.has(am.status);
    const currentMinute = isInPlay ? am.minute ?? null : null;
    const injuryTime = isInPlay ? am.injuryTime ?? null : null;

    updates.push({ id: matched.id, am, scoreA, scoreB, currentMinute, injuryTime });
  }

  // Parallel UPDATEs — capped to ~5 concurrent by the postgres client pool.
  await Promise.all(
    updates.map(async (u) => {
      await sql`
        UPDATE matches SET
          actual_score_a = ${u.scoreA},
          actual_score_b = ${u.scoreB},
          status         = ${u.am.status},
          current_minute = ${u.currentMinute},
          injury_time    = ${u.injuryTime}
        WHERE id = ${u.id} AND NOT manual_override
      `;
    }),
  );

  return {
    apiCount: apiMatches.length,
    updated: updates.length,
    unchanged,
    unmatched,
  };
}

// "Sync fixtures + teams" button — pulls the full season so even matches that
// aren't today get their scores refreshed. Despite the name, it no longer
// touches the teams table. Kept for UI compatibility.
export async function runFixturesSync(): Promise<FixturesSyncReport> {
  const r = await syncScores(fetchWcMatches);
  return {
    teams: EMPTY_TEAM_REPORT,
    matches: {
      api_count: r.apiCount,
      inserted: 0,
      updated: r.updated,
      skipped: r.unmatched.map((u) => ({
        api_id: u.api_id,
        reason: `no DB match for ${u.home} vs ${u.away} on that date`,
      })),
    },
  };
}

// "Sync results only" button — uses thesportsdb's /eventsday endpoint which
// returns just today's events. Cheaper, runs every 10 min via autoSync.
export async function runResultsSync(): Promise<ResultsSyncReport> {
  const r = await syncScores(fetchLiveWcMatches);
  return {
    api_count: r.apiCount,
    updated: r.updated,
    unchanged: r.unchanged,
    not_linked: r.unmatched.map((u) => u.api_id),
  };
}
