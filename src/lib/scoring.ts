import { sql } from "./db";
import { POINTS, scoreMatch } from "./matchScore";
import { gradeMarket, MARKET_BY_ID } from "./markets";

export { POINTS, scoreMatch };

export type UserBetMarket = {
  market_id: string;
  market_label: string;
  pick_label: string;
  pts: number;
};

export type UserBet = {
  match_id: number;
  kickoff_at: Date;
  label: string;
  actual_score: string;
  prediction_score: string | null;
  score_pts: number;
  markets: UserBetMarket[];
  total_pts: number;
};

export type DailyPlayer = {
  user_id: number;
  display_name: string;
  username: string;
  discriminator: string;
  pts: number;
};

export type DailyTopBottom = {
  date: string;
  winner: DailyPlayer;
  loser: DailyPlayer | null;
  winnerBets: UserBet[];
  loserBets: UserBet[];
};

export async function computeDailyTopBottom(
  userIds: number[]
): Promise<DailyTopBottom | null> {
  if (userIds.length === 0) return null;

  // The most recent UTC kickoff date that has any finished matches drives the
  // "today" window — keeps the card meaningful even if today's matches haven't
  // finished yet or the tournament is mid-rest day.
  const latest = await sql<{ date: string }[]>`
    SELECT to_char((kickoff_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date
    FROM matches
    WHERE actual_score_a IS NOT NULL AND actual_score_b IS NOT NULL
    ORDER BY kickoff_at DESC
    LIMIT 1
  `;
  if (latest.length === 0) return null;
  const date = latest[0].date;

  const matches = await sql<
    {
      id: number;
      kickoff_at: Date;
      actual_score_a: number;
      actual_score_b: number;
      team_a: string | null;
      team_b: string | null;
    }[]
  >`
    SELECT m.id, m.kickoff_at, m.actual_score_a, m.actual_score_b,
           COALESCE(ta.name, m.team_a_label) AS team_a,
           COALESCE(tb.name, m.team_b_label) AS team_b
    FROM matches m
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
    WHERE m.actual_score_a IS NOT NULL
      AND m.actual_score_b IS NOT NULL
      AND (m.kickoff_at AT TIME ZONE 'UTC')::date = ${date}::date
    ORDER BY m.kickoff_at ASC
  `;
  if (matches.length === 0) return null;

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const matchIds = matches.map((m) => m.id);
  const users = await sql<
    { id: number; display_name: string; username: string; discriminator: string }[]
  >`
    SELECT id, display_name, username, discriminator FROM users
    WHERE id = ANY(${userIds})
  `;
  const userById = new Map(users.map((u) => [u.id, u]));

  const [scorePreds, marketPreds] = await Promise.all([
    sql<{ user_id: number; match_id: number; score_a: number; score_b: number }[]>`
      SELECT user_id, match_id, score_a, score_b FROM match_predictions
      WHERE user_id = ANY(${userIds}) AND match_id = ANY(${matchIds})
    `,
    sql<{ user_id: number; match_id: number; market: string; pick: string }[]>`
      SELECT user_id, match_id, market, pick FROM match_market_predictions
      WHERE user_id = ANY(${userIds}) AND match_id = ANY(${matchIds})
    `,
  ]);

  const betsByUser = new Map<number, Map<number, UserBet>>();
  const ensureBet = (uid: number, mid: number): UserBet | null => {
    const m = matchById.get(mid);
    if (!m) return null;
    let inner = betsByUser.get(uid);
    if (!inner) {
      inner = new Map();
      betsByUser.set(uid, inner);
    }
    let bet = inner.get(mid);
    if (!bet) {
      bet = {
        match_id: m.id,
        kickoff_at: m.kickoff_at,
        label: `${m.team_a ?? "TBD"} vs ${m.team_b ?? "TBD"}`,
        actual_score: `${m.actual_score_a}-${m.actual_score_b}`,
        prediction_score: null,
        score_pts: 0,
        markets: [],
        total_pts: 0,
      };
      inner.set(mid, bet);
    }
    return bet;
  };

  for (const p of scorePreds) {
    const bet = ensureBet(p.user_id, p.match_id);
    const m = matchById.get(p.match_id);
    if (!bet || !m) continue;
    bet.prediction_score = `${p.score_a}-${p.score_b}`;
    bet.score_pts = scoreMatch(
      p.score_a,
      p.score_b,
      m.actual_score_a,
      m.actual_score_b
    );
    bet.total_pts += bet.score_pts;
  }
  for (const mp of marketPreds) {
    const bet = ensureBet(mp.user_id, mp.match_id);
    const m = matchById.get(mp.match_id);
    if (!bet || !m) continue;
    const pts = gradeMarket(mp.market, mp.pick, m.actual_score_a, m.actual_score_b);
    const def = MARKET_BY_ID[mp.market];
    const opt = def?.options.find((o) => o.value === mp.pick);
    bet.markets.push({
      market_id: mp.market,
      market_label: def?.short ?? mp.market,
      pick_label: opt?.label ?? mp.pick,
      pts,
    });
    bet.total_pts += pts;
  }

  const totals: { uid: number; pts: number }[] = [];
  for (const [uid, inner] of betsByUser) {
    let sum = 0;
    for (const bet of inner.values()) sum += bet.total_pts;
    totals.push({ uid, pts: sum });
  }
  if (totals.length === 0) return null;
  totals.sort((a, b) => b.pts - a.pts || a.uid - b.uid);

  const mk = (uid: number, pts: number): DailyPlayer => {
    const u = userById.get(uid)!;
    return {
      user_id: uid,
      display_name: u.display_name,
      username: u.username,
      discriminator: u.discriminator,
      pts,
    };
  };
  const betsOf = (uid: number): UserBet[] => {
    const inner = betsByUser.get(uid);
    if (!inner) return [];
    return [...inner.values()].sort((a, b) => b.total_pts - a.total_pts);
  };

  const top = totals[0];
  const bottom = totals.length > 1 ? totals[totals.length - 1] : null;
  return {
    date,
    winner: mk(top.uid, top.pts),
    loser: bottom ? mk(bottom.uid, bottom.pts) : null,
    winnerBets: betsOf(top.uid),
    loserBets: bottom ? betsOf(bottom.uid) : [],
  };
}

export async function getUserBets(userId: number): Promise<UserBet[]> {
  const matches = await sql<
    {
      id: number;
      kickoff_at: Date;
      actual_score_a: number;
      actual_score_b: number;
      team_a: string | null;
      team_b: string | null;
    }[]
  >`
    SELECT m.id, m.kickoff_at, m.actual_score_a, m.actual_score_b,
           COALESCE(ta.name, m.team_a_label) AS team_a,
           COALESCE(tb.name, m.team_b_label) AS team_b
    FROM matches m
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
    WHERE m.actual_score_a IS NOT NULL AND m.actual_score_b IS NOT NULL
    ORDER BY m.kickoff_at DESC
  `;
  if (matches.length === 0) return [];

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const matchIds = matches.map((m) => m.id);

  const [scorePreds, marketPreds] = await Promise.all([
    sql<{ match_id: number; score_a: number; score_b: number }[]>`
      SELECT match_id, score_a, score_b FROM match_predictions
      WHERE user_id = ${userId} AND match_id = ANY(${matchIds})
    `,
    sql<{ match_id: number; market: string; pick: string }[]>`
      SELECT match_id, market, pick FROM match_market_predictions
      WHERE user_id = ${userId} AND match_id = ANY(${matchIds})
    `,
  ]);

  const bets = new Map<number, UserBet>();
  for (const m of matches) {
    bets.set(m.id, {
      match_id: m.id,
      kickoff_at: m.kickoff_at,
      label: `${m.team_a ?? "TBD"} vs ${m.team_b ?? "TBD"}`,
      actual_score: `${m.actual_score_a}-${m.actual_score_b}`,
      prediction_score: null,
      score_pts: 0,
      markets: [],
      total_pts: 0,
    });
  }

  for (const p of scorePreds) {
    const bet = bets.get(p.match_id);
    const m = matchById.get(p.match_id);
    if (!bet || !m) continue;
    bet.prediction_score = `${p.score_a}-${p.score_b}`;
    bet.score_pts = scoreMatch(
      p.score_a,
      p.score_b,
      m.actual_score_a,
      m.actual_score_b
    );
    bet.total_pts += bet.score_pts;
  }

  for (const mp of marketPreds) {
    const bet = bets.get(mp.match_id);
    const m = matchById.get(mp.match_id);
    if (!bet || !m) continue;
    const pts = gradeMarket(mp.market, mp.pick, m.actual_score_a, m.actual_score_b);
    const def = MARKET_BY_ID[mp.market];
    const opt = def?.options.find((o) => o.value === mp.pick);
    bet.markets.push({
      market_id: mp.market,
      market_label: def?.short ?? mp.market,
      pick_label: opt?.label ?? mp.pick,
      pts,
    });
    bet.total_pts += pts;
  }

  return [...bets.values()].filter(
    (b) => b.prediction_score != null || b.markets.length > 0
  );
}


export type Highlight = {
  user_id: number;
  display_name: string;
  username: string;
  discriminator: string;
  pts: number;
};

export type MatchHighlight = {
  match_id: number;
  kickoff_at: Date;
  label: string;
  top: Highlight;
  bottom: Highlight;
};

export type DayHighlight = {
  date: string;
  top: Highlight;
  bottom: Highlight;
};

export type Highlights = {
  byMatch: MatchHighlight[];
  byDay: DayHighlight[];
};

export async function computeHighlights(userIds: number[]): Promise<Highlights> {
  if (userIds.length === 0) return { byMatch: [], byDay: [] };

  const matches = await sql<
    {
      id: number;
      kickoff_at: Date;
      actual_score_a: number;
      actual_score_b: number;
      team_a: string | null;
      team_b: string | null;
    }[]
  >`
    SELECT m.id, m.kickoff_at, m.actual_score_a, m.actual_score_b,
           COALESCE(ta.name, m.team_a_label) AS team_a,
           COALESCE(tb.name, m.team_b_label) AS team_b
    FROM matches m
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
    WHERE m.actual_score_a IS NOT NULL AND m.actual_score_b IS NOT NULL
    ORDER BY m.kickoff_at DESC
  `;
  if (matches.length === 0) return { byMatch: [], byDay: [] };

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const matchIds = matches.map((m) => m.id);

  const users = await sql<
    { id: number; display_name: string; username: string; discriminator: string }[]
  >`
    SELECT id, display_name, username, discriminator FROM users
    WHERE id = ANY(${userIds})
  `;
  const userById = new Map(users.map((u) => [u.id, u]));

  const matchPreds = await sql<
    { user_id: number; match_id: number; score_a: number; score_b: number }[]
  >`
    SELECT user_id, match_id, score_a, score_b FROM match_predictions
    WHERE user_id = ANY(${userIds}) AND match_id = ANY(${matchIds})
  `;
  const marketPreds = await sql<
    { user_id: number; match_id: number; market: string; pick: string }[]
  >`
    SELECT user_id, match_id, market, pick FROM match_market_predictions
    WHERE user_id = ANY(${userIds}) AND match_id = ANY(${matchIds})
  `;

  // pts[userId][matchId] = points; only set when user actually predicted.
  const pts = new Map<number, Map<number, number>>();
  const bump = (uid: number, mid: number, delta: number) => {
    let inner = pts.get(uid);
    if (!inner) {
      inner = new Map();
      pts.set(uid, inner);
    }
    inner.set(mid, (inner.get(mid) ?? 0) + delta);
  };
  for (const p of matchPreds) {
    const m = matchById.get(p.match_id);
    if (!m) continue;
    bump(
      p.user_id,
      p.match_id,
      scoreMatch(p.score_a, p.score_b, m.actual_score_a, m.actual_score_b)
    );
  }
  for (const mp of marketPreds) {
    const m = matchById.get(mp.match_id);
    if (!m) continue;
    const delta = gradeMarket(mp.market, mp.pick, m.actual_score_a, m.actual_score_b);
    if (delta !== 0) bump(mp.user_id, mp.match_id, delta);
  }

  const toHighlight = (uid: number, p: number): Highlight => {
    const u = userById.get(uid)!;
    return {
      user_id: uid,
      display_name: u.display_name,
      username: u.username,
      discriminator: u.discriminator,
      pts: p,
    };
  };

  const byMatch: MatchHighlight[] = [];
  for (const m of matches) {
    const entries: [number, number][] = [];
    for (const uid of userIds) {
      const v = pts.get(uid)?.get(m.id);
      if (v != null) entries.push([uid, v]);
    }
    if (entries.length === 0) continue;
    entries.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const top = entries[0];
    const bottom = entries[entries.length - 1];
    byMatch.push({
      match_id: m.id,
      kickoff_at: m.kickoff_at,
      label: `${m.team_a ?? "TBD"} vs ${m.team_b ?? "TBD"} (${m.actual_score_a}-${m.actual_score_b})`,
      top: toHighlight(top[0], top[1]),
      bottom: toHighlight(bottom[0], bottom[1]),
    });
  }

  // Aggregate by UTC date of kickoff.
  const dayTotals = new Map<string, Map<number, number>>();
  for (const m of matches) {
    const date = new Date(m.kickoff_at).toISOString().slice(0, 10);
    let perUser = dayTotals.get(date);
    if (!perUser) {
      perUser = new Map();
      dayTotals.set(date, perUser);
    }
    for (const uid of userIds) {
      const v = pts.get(uid)?.get(m.id);
      if (v != null) perUser.set(uid, (perUser.get(uid) ?? 0) + v);
    }
  }

  const byDay: DayHighlight[] = [];
  for (const [date, perUser] of dayTotals) {
    const entries = [...perUser.entries()];
    if (entries.length === 0) continue;
    entries.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const top = entries[0];
    const bottom = entries[entries.length - 1];
    byDay.push({
      date,
      top: toHighlight(top[0], top[1]),
      bottom: toHighlight(bottom[0], bottom[1]),
    });
  }
  byDay.sort((a, b) => (a.date < b.date ? 1 : -1));

  return { byMatch, byDay };
}

export type LeaderboardRow = {
  user_id: number;
  username: string;
  discriminator: string;
  display_name: string;
  match_points: number;
  group_points: number;
  bracket_points: number;
  total: number;
};

export async function computeLeaderboard(
  userIds: number[]
): Promise<LeaderboardRow[]> {
  if (userIds.length === 0) return [];
  const users = await sql<
    { id: number; username: string; discriminator: string; display_name: string }[]
  >`
    SELECT id, username, discriminator, display_name FROM users
    WHERE id = ANY(${userIds})
  `;
  const finishedMatches = await sql<
    { id: number; actual_score_a: number; actual_score_b: number }[]
  >`
    SELECT id, actual_score_a, actual_score_b FROM matches
    WHERE actual_score_a IS NOT NULL AND actual_score_b IS NOT NULL
  `;
  const matchPreds = await sql<
    { user_id: number; match_id: number; score_a: number; score_b: number }[]
  >`
    SELECT user_id, match_id, score_a, score_b FROM match_predictions
  `;

  const matchById = new Map(finishedMatches.map((m) => [m.id, m]));
  const matchPts = new Map<number, number>();
  for (const p of matchPreds) {
    const m = matchById.get(p.match_id);
    if (!m) continue;
    const pts = scoreMatch(p.score_a, p.score_b, m.actual_score_a, m.actual_score_b);
    matchPts.set(p.user_id, (matchPts.get(p.user_id) ?? 0) + pts);
  }

  // Bonus points from optional betting-style markets (Over/Under, BTTS, etc.).
  // Rolled into match_points so existing leaderboard UI doesn't need a new column.
  const marketPreds = await sql<
    { user_id: number; match_id: number; market: string; pick: string }[]
  >`
    SELECT user_id, match_id, market, pick FROM match_market_predictions
  `;
  for (const mp of marketPreds) {
    const m = matchById.get(mp.match_id);
    if (!m) continue;
    const pts = gradeMarket(mp.market, mp.pick, m.actual_score_a, m.actual_score_b);
    if (pts !== 0) matchPts.set(mp.user_id, (matchPts.get(mp.user_id) ?? 0) + pts);
  }

  const groupResults = await sql<
    { group_letter: string; position: number; team_id: number }[]
  >`SELECT group_letter, position, team_id FROM group_results`;
  const groupResMap = new Map<string, Record<number, number>>();
  for (const r of groupResults) {
    const cur = groupResMap.get(r.group_letter) ?? {};
    cur[r.position] = r.team_id;
    groupResMap.set(r.group_letter, cur);
  }
  const groupPreds = await sql<
    { user_id: number; group_letter: string; position: number; team_id: number }[]
  >`SELECT user_id, group_letter, position, team_id FROM group_predictions`;
  const userGroupPicks = new Map<string, Map<number, number>>();
  for (const gp of groupPreds) {
    const key = `${gp.user_id}|${gp.group_letter}`;
    let inner = userGroupPicks.get(key);
    if (!inner) {
      inner = new Map();
      userGroupPicks.set(key, inner);
    }
    inner.set(gp.position, gp.team_id);
  }
  const groupPts = new Map<number, number>();
  for (const [key, picks] of userGroupPicks) {
    const [uidStr, group] = key.split("|");
    const uid = Number(uidStr);
    const actual = groupResMap.get(group);
    if (!actual) continue;
    const actualTop2 = new Set<number>();
    if (actual[1]) actualTop2.add(actual[1]);
    if (actual[2]) actualTop2.add(actual[2]);
    let pts = 0;
    const pick1 = picks.get(1);
    const pick2 = picks.get(2);
    if (pick1) {
      if (actual[1] && pick1 === actual[1]) pts += POINTS.groupPositionExact;
      else if (actualTop2.has(pick1)) pts += POINTS.groupTopTwoAnyOrder;
    }
    if (pick2) {
      if (actual[2] && pick2 === actual[2]) pts += POINTS.groupPositionExact;
      else if (actualTop2.has(pick2)) pts += POINTS.groupTopTwoAnyOrder;
    }
    groupPts.set(uid, (groupPts.get(uid) ?? 0) + pts);
  }

  const bracketResults = await sql<{ stage: string; team_id: number }[]>`
    SELECT stage, team_id FROM bracket_results
  `;
  const bracketResSet = new Set(
    bracketResults.map((r) => `${r.stage}|${r.team_id}`)
  );
  const bracketPreds = await sql<
    { user_id: number; stage: string; team_id: number }[]
  >`SELECT user_id, stage, team_id FROM bracket_predictions`;
  const bracketPts = new Map<number, number>();
  for (const bp of bracketPreds) {
    if (!bracketResSet.has(`${bp.stage}|${bp.team_id}`)) continue;
    const stagePts =
      POINTS.bracket[bp.stage as keyof typeof POINTS.bracket] ?? 0;
    bracketPts.set(bp.user_id, (bracketPts.get(bp.user_id) ?? 0) + stagePts);
  }

  return users
    .map((u) => {
      const mp = matchPts.get(u.id) ?? 0;
      const gp = groupPts.get(u.id) ?? 0;
      const bp = bracketPts.get(u.id) ?? 0;
      return {
        user_id: u.id,
        username: u.username,
        discriminator: u.discriminator,
        display_name: u.display_name,
        match_points: mp,
        group_points: gp,
        bracket_points: bp,
        total: mp + gp + bp,
      };
    })
    .sort((a, b) => b.total - a.total);
}
