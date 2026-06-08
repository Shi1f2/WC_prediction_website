import { sql } from "./db";
import { POINTS, scoreMatch } from "./matchScore";

export { POINTS, scoreMatch };

export type LeaderboardRow = {
  user_id: number;
  username: string;
  display_name: string;
  match_points: number;
  group_points: number;
  bracket_points: number;
  total: number;
};

export async function computeLeaderboard(): Promise<LeaderboardRow[]> {
  const users = await sql<{ id: number; username: string; display_name: string }[]>`
    SELECT id, username, display_name FROM users
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
        display_name: u.display_name,
        match_points: mp,
        group_points: gp,
        bracket_points: bp,
        total: mp + gp + bp,
      };
    })
    .sort((a, b) => b.total - a.total);
}
