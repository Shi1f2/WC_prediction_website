import { sql } from "./db";
import { POINTS, scoreMatch } from "./matchScore";

export type TeamRow = {
  id: number;
  name: string;
  code: string;
  flag: string;
  group_letter: string | null;
};

export type GroupPickRow = {
  group_letter: string;
  position: number;
  team_id: number;
};

export type BracketPickRow = { stage: string; team_id: number };

export type MatchInfo = {
  id: number;
  stage: string;
  group_letter: string | null;
  kickoff_at: Date;
  team_a_label: string;
  team_b_label: string;
  team_a_name: string | null;
  team_a_flag: string | null;
  team_b_name: string | null;
  team_b_flag: string | null;
  status: string | null;
  actual_score_a: number | null;
  actual_score_b: number | null;
};

export type MatchPickRow = {
  match_id: number;
  score_a: number;
  score_b: number;
};

export type MatchMarketPicks = Record<string, string>;

export type PicksBundle = {
  viewer: {
    bracketCommittedAt: Date | null;
    // Groups where the viewer has set BOTH positions 1 & 2 — anything less
    // doesn't count as "completed" for the purposes of revealing a friend's pick.
    groupsCompleted: Set<string>;
    matchesPredicted: Set<number>;
  };
  member: {
    id: number;
    display_name: string;
    username: string;
    discriminator: string;
    bracketCommittedAt: Date | null;
    bracket: BracketPickRow[];
    groups: GroupPickRow[];
    matches: MatchPickRow[];
    // Per-match optional market picks (Over/Under, BTTS, margin) keyed by match_id.
    markets: Map<number, MatchMarketPicks>;
  };
  teams: Map<number, TeamRow>;
  matches: MatchInfo[];
  bracketLockedAt: Date | null;
  // Actual outcomes used to grade the visible picks. Both empty until results
  // get entered, in which case the per-pick deltas all read as 0.
  groupResults: Map<string, Map<number, number>>;
  bracketResults: Set<string>;
};

export function bracketPickPoints(
  pick: BracketPickRow,
  results: Set<string>
): number {
  if (!results.has(`${pick.stage}|${pick.team_id}`)) return 0;
  return POINTS.bracket[pick.stage as keyof typeof POINTS.bracket] ?? 0;
}

// Returns the points contributed by a single position pick. The group's full
// actual standings are passed so we can grant the "top-2-wrong-order" credit.
export function groupPositionPoints(
  position: number,
  pickedTeamId: number,
  actual: Map<number, number> | undefined
): number {
  if (!actual) return 0;
  if (position !== 1 && position !== 2) return 0;
  const exact = actual.get(position);
  if (exact != null && pickedTeamId === exact) return POINTS.groupPositionExact;
  const top2 = new Set<number>();
  if (actual.get(1)) top2.add(actual.get(1)!);
  if (actual.get(2)) top2.add(actual.get(2)!);
  if (top2.has(pickedTeamId)) return POINTS.groupTopTwoAnyOrder;
  return 0;
}

export function matchPickPoints(
  pick: MatchPickRow,
  match: MatchInfo
): number | null {
  if (match.actual_score_a == null || match.actual_score_b == null) return null;
  return scoreMatch(
    pick.score_a,
    pick.score_b,
    match.actual_score_a,
    match.actual_score_b
  );
}

export async function loadPicksBundle(
  viewerId: number,
  memberId: number
): Promise<PicksBundle> {
  const [viewerRow, memberRow] = await Promise.all([
    sql<{ bracket_committed_at: Date | null }[]>`
      SELECT bracket_committed_at FROM users WHERE id = ${viewerId}
    `,
    sql<
      {
        id: number;
        display_name: string;
        username: string;
        discriminator: string;
        bracket_committed_at: Date | null;
      }[]
    >`
      SELECT id, display_name, username, discriminator, bracket_committed_at
      FROM users WHERE id = ${memberId}
    `,
  ]);
  if (memberRow.length === 0) throw new Error("Member not found");

  const [
    viewerGroupRows,
    viewerMatches,
    memberBracket,
    memberGroups,
    memberMatches,
    memberMarkets,
    teams,
    matches,
    groupResultRows,
    bracketResultRows,
  ] = await Promise.all([
    sql<{ group_letter: string; position: number }[]>`
      SELECT group_letter, position FROM group_predictions WHERE user_id = ${viewerId}
    `,
    sql<{ match_id: number }[]>`
      SELECT DISTINCT match_id FROM match_predictions WHERE user_id = ${viewerId}
    `,
    sql<BracketPickRow[]>`
      SELECT stage, team_id FROM bracket_predictions WHERE user_id = ${memberId}
    `,
    sql<GroupPickRow[]>`
      SELECT group_letter, position, team_id FROM group_predictions
      WHERE user_id = ${memberId}
    `,
    sql<MatchPickRow[]>`
      SELECT match_id, score_a, score_b FROM match_predictions
      WHERE user_id = ${memberId}
    `,
    sql<{ match_id: number; market: string; pick: string }[]>`
      SELECT match_id, market, pick FROM match_market_predictions
      WHERE user_id = ${memberId}
    `,
    sql<TeamRow[]>`SELECT id, name, code, flag, group_letter FROM teams`,
    sql<
      {
        id: number;
        stage: string;
        group_letter: string | null;
        kickoff_at: Date;
        team_a: string | null;
        team_a_flag: string | null;
        team_b: string | null;
        team_b_flag: string | null;
        team_a_label: string | null;
        team_b_label: string | null;
        status: string | null;
        actual_score_a: number | null;
        actual_score_b: number | null;
      }[]
    >`
      SELECT m.id, m.stage, m.group_letter, m.kickoff_at,
             ta.name AS team_a, ta.flag AS team_a_flag,
             tb.name AS team_b, tb.flag AS team_b_flag,
             m.team_a_label, m.team_b_label,
             m.status,
             m.actual_score_a, m.actual_score_b
      FROM matches m
      LEFT JOIN teams ta ON ta.id = m.team_a_id
      LEFT JOIN teams tb ON tb.id = m.team_b_id
      ORDER BY m.kickoff_at ASC, m.id ASC
    `,
    sql<{ group_letter: string; position: number; team_id: number }[]>`
      SELECT group_letter, position, team_id FROM group_results
    `,
    sql<{ stage: string; team_id: number }[]>`
      SELECT stage, team_id FROM bracket_results
    `,
  ]);

  const viewerGroupPositions = new Map<string, Set<number>>();
  for (const r of viewerGroupRows) {
    let s = viewerGroupPositions.get(r.group_letter);
    if (!s) {
      s = new Set();
      viewerGroupPositions.set(r.group_letter, s);
    }
    s.add(r.position);
  }
  const viewerGroupsCompleted = new Set<string>();
  for (const [g, positions] of viewerGroupPositions) {
    if (positions.has(1) && positions.has(2)) viewerGroupsCompleted.add(g);
  }

  const groupResults = new Map<string, Map<number, number>>();
  for (const r of groupResultRows) {
    let m = groupResults.get(r.group_letter);
    if (!m) {
      m = new Map();
      groupResults.set(r.group_letter, m);
    }
    m.set(r.position, r.team_id);
  }
  const bracketResults = new Set(
    bracketResultRows.map((r) => `${r.stage}|${r.team_id}`)
  );

  // Bracket lock = first knockout match kickoff (matches the rule used in
  // /board so the "viewing window" stays consistent across the app).
  const firstKnockout = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches
    WHERE stage IN ('r32','r16')
    ORDER BY kickoff_at ASC LIMIT 1
  `;
  const bracketLockedAt = firstKnockout[0]?.kickoff_at ?? null;

  return {
    viewer: {
      bracketCommittedAt: viewerRow[0]?.bracket_committed_at ?? null,
      groupsCompleted: viewerGroupsCompleted,
      matchesPredicted: new Set(viewerMatches.map((r) => r.match_id)),
    },
    member: {
      id: memberRow[0].id,
      display_name: memberRow[0].display_name,
      username: memberRow[0].username,
      discriminator: memberRow[0].discriminator,
      bracketCommittedAt: memberRow[0].bracket_committed_at,
      bracket: memberBracket,
      groups: memberGroups,
      matches: memberMatches,
      markets: (() => {
        const map = new Map<number, MatchMarketPicks>();
        for (const r of memberMarkets) {
          const cur = map.get(r.match_id) ?? {};
          cur[r.market] = r.pick;
          map.set(r.match_id, cur);
        }
        return map;
      })(),
    },
    teams: new Map(teams.map((t) => [t.id, t])),
    matches: matches.map((m) => ({
      id: m.id,
      stage: m.stage,
      group_letter: m.group_letter,
      kickoff_at: m.kickoff_at,
      team_a_label: m.team_a ?? m.team_a_label ?? "TBD",
      team_b_label: m.team_b ?? m.team_b_label ?? "TBD",
      team_a_name: m.team_a,
      team_a_flag: m.team_a_flag,
      team_b_name: m.team_b,
      team_b_flag: m.team_b_flag,
      status: m.status,
      actual_score_a: m.actual_score_a,
      actual_score_b: m.actual_score_b,
    })),
    bracketLockedAt,
    groupResults,
    bracketResults,
  };
}
