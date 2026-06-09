import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const LIMITS: Record<string, number> = { R16: 16, QF: 8, SF: 4, FINAL: 2, WINNER: 1 };

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const lockRows = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches
    WHERE stage IN ('r32', 'r16') ORDER BY kickoff_at ASC LIMIT 1
  `;
  if (lockRows.length && new Date(lockRows[0].kickoff_at).getTime() <= Date.now())
    return NextResponse.json({ error: "Locked" }, { status: 403 });

  // Also reject changes if the user has personally committed their bracket.
  const committed = await sql<{ bracket_committed_at: Date | null }[]>`
    SELECT bracket_committed_at FROM users WHERE id = ${user.id}
  `;
  if (committed[0]?.bracket_committed_at) {
    return NextResponse.json(
      { error: "Bracket already locked in" },
      { status: 403 }
    );
  }

  const cleaned: Record<string, number[]> = {};
  for (const stage of Object.keys(LIMITS)) {
    const raw = body[stage];
    if (!Array.isArray(raw))
      return NextResponse.json({ error: `Missing ${stage}` }, { status: 400 });
    const ids = [...new Set(raw.map(Number))].filter((n) => Number.isInteger(n));
    if (ids.length > LIMITS[stage])
      return NextResponse.json({ error: `Too many ${stage} picks` }, { status: 400 });
    cleaned[stage] = ids;
  }

  await sql.begin(async (tx) => {
    await tx`DELETE FROM bracket_predictions WHERE user_id = ${user.id}`;
    for (const [stage, ids] of Object.entries(cleaned)) {
      for (const id of ids) {
        await tx`
          INSERT INTO bracket_predictions (user_id, stage, team_id, updated_at)
          VALUES (${user.id}, ${stage}, ${id}, NOW())
        `;
      }
    }
  });

  return NextResponse.json({ ok: true });
}
