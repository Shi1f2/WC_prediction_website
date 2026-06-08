import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const letter = String(body?.group_letter ?? "");
  if (!/^[A-L]$/.test(letter))
    return NextResponse.json({ error: "Invalid group" }, { status: 400 });

  const positions: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
  if (body?.positions && typeof body.positions === "object") {
    for (const p of [1, 2, 3, 4]) {
      const raw = body.positions[p] ?? body.positions[String(p)];
      if (raw == null || raw === "") {
        positions[p] = null;
      } else {
        const n = Number(raw);
        if (Number.isInteger(n)) positions[p] = n;
      }
    }
  } else {
    if (body?.first_team_id) positions[1] = Number(body.first_team_id);
    if (body?.second_team_id) positions[2] = Number(body.second_team_id);
  }

  const lockRows = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches
    WHERE stage = 'group' AND group_letter = ${letter}
    ORDER BY kickoff_at ASC LIMIT 1
  `;
  if (lockRows.length && new Date(lockRows[0].kickoff_at).getTime() <= Date.now())
    return NextResponse.json({ error: "Locked" }, { status: 403 });

  const pickedIds = [...new Set(
    Object.values(positions).filter((x): x is number => x != null)
  )];
  if (pickedIds.length > 0) {
    const valid = await sql<{ id: number }[]>`
      SELECT id FROM teams
      WHERE group_letter = ${letter} AND id = ANY(${pickedIds})
    `;
    if (valid.length !== pickedIds.length)
      return NextResponse.json(
        { error: "One or more teams are not in this group" },
        { status: 400 }
      );
  }

  await sql.begin(async (tx) => {
    for (const pos of [1, 2, 3, 4]) {
      const teamId = positions[pos];
      if (teamId == null) {
        await tx`
          DELETE FROM group_predictions
          WHERE user_id = ${user.id}
            AND group_letter = ${letter}
            AND position = ${pos}
        `;
      } else {
        await tx`
          INSERT INTO group_predictions (user_id, group_letter, position, team_id, updated_at)
          VALUES (${user.id}, ${letter}, ${pos}, ${teamId}, NOW())
          ON CONFLICT (user_id, group_letter, position)
          DO UPDATE SET team_id = EXCLUDED.team_id, updated_at = NOW()
        `;
      }
    }
  });

  return NextResponse.json({ ok: true });
}
