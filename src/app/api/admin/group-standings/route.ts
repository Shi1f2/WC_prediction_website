import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

// Computes group standings from finished group-stage match scores using the
// first three FIFA tiebreakers: points (3/1/0), then goal difference, then
// goals scored. Anything beyond that (head-to-head, fair play, lots) is
// flagged as a tie for the admin to break by hand — we won't guess.

export const dynamic = "force-dynamic";

type Standing = {
  team_id: number;
  name: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

type GroupComputation = {
  group_letter: string;
  // Ordered 1st → 4th. Ties (teams that share pts+gd+gf with another) are
  // included but flagged via `tied_with`.
  standings: (Standing & {
    position: number;
    tied_with: number[];
  })[];
  // True when at least one ordered pair is indistinguishable by pts/gd/gf —
  // admin needs to manually break it.
  has_unresolved_tie: boolean;
};

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All teams with their group letter.
  const teams = await sql<
    { id: number; name: string; group_letter: string | null }[]
  >`SELECT id, name, group_letter FROM teams WHERE group_letter IS NOT NULL`;

  // Every finished group-stage match with both scores in.
  const matches = await sql<
    {
      group_letter: string | null;
      team_a_id: number | null;
      team_b_id: number | null;
      actual_score_a: number;
      actual_score_b: number;
    }[]
  >`
    SELECT group_letter, team_a_id, team_b_id, actual_score_a, actual_score_b
    FROM matches
    WHERE stage = 'group'
      AND actual_score_a IS NOT NULL
      AND actual_score_b IS NOT NULL
      AND team_a_id IS NOT NULL
      AND team_b_id IS NOT NULL
  `;

  // Bucket teams by group, seed empty standings.
  const byLetter = new Map<string, Map<number, Standing>>();
  for (const t of teams) {
    const letter = t.group_letter!;
    let g = byLetter.get(letter);
    if (!g) {
      g = new Map();
      byLetter.set(letter, g);
    }
    g.set(t.id, {
      team_id: t.id,
      name: t.name,
      played: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    });
  }

  // Walk every finished match, applying points to both teams.
  for (const m of matches) {
    if (!m.group_letter) continue;
    const g = byLetter.get(m.group_letter);
    if (!g) continue;
    const a = g.get(m.team_a_id!);
    const b = g.get(m.team_b_id!);
    if (!a || !b) continue;

    a.played++;
    b.played++;
    a.gf += m.actual_score_a;
    a.ga += m.actual_score_b;
    b.gf += m.actual_score_b;
    b.ga += m.actual_score_a;

    if (m.actual_score_a > m.actual_score_b) {
      a.w++;
      b.l++;
      a.pts += 3;
    } else if (m.actual_score_a < m.actual_score_b) {
      b.w++;
      a.l++;
      b.pts += 3;
    } else {
      a.d++;
      b.d++;
      a.pts += 1;
      b.pts += 1;
    }
  }

  for (const g of byLetter.values()) {
    for (const s of g.values()) s.gd = s.gf - s.ga;
  }

  const results: GroupComputation[] = [];
  for (const [letter, g] of [...byLetter.entries()].sort()) {
    const list = [...g.values()];
    // Sort by pts desc, then gd desc, then gf desc. Anything beyond that is
    // a real tie — we won't fabricate an order.
    list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    let hasUnresolved = false;
    const standings = list.map((s, i) => {
      const tied_with: number[] = [];
      for (const other of list) {
        if (other.team_id === s.team_id) continue;
        if (
          other.pts === s.pts &&
          other.gd === s.gd &&
          other.gf === s.gf
        ) {
          tied_with.push(other.team_id);
        }
      }
      if (tied_with.length > 0) hasUnresolved = true;
      return { ...s, position: i + 1, tied_with };
    });

    results.push({
      group_letter: letter,
      standings,
      has_unresolved_tie: hasUnresolved,
    });
  }

  return NextResponse.json({ groups: results });
}
