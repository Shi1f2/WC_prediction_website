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
  const matchId = Number(body?.match_id);
  const a = Number(body?.score_a);
  const b = Number(body?.score_b);
  if (
    !Number.isInteger(matchId) ||
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a < 0 ||
    b < 0 ||
    a > 20 ||
    b > 20
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const m = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches WHERE id = ${matchId} LIMIT 1
  `;
  if (m.length === 0)
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  const msUntil = new Date(m[0].kickoff_at).getTime() - Date.now();
  if (msUntil <= 0)
    return NextResponse.json({ error: "Locked" }, { status: 403 });
  if (msUntil > 24 * 60 * 60 * 1000)
    return NextResponse.json(
      { error: "Not open yet — opens 24h before kickoff" },
      { status: 403 }
    );

  await sql`
    INSERT INTO match_predictions (user_id, match_id, score_a, score_b, updated_at)
    VALUES (${user.id}, ${matchId}, ${a}, ${b}, NOW())
    ON CONFLICT (user_id, match_id) DO UPDATE
      SET score_a = EXCLUDED.score_a,
          score_b = EXCLUDED.score_b,
          updated_at = NOW()
  `;
  return NextResponse.json({ ok: true });
}
