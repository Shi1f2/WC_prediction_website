import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const matchId = Number(body?.match_id);
  const a = body?.score_a == null ? null : Number(body.score_a);
  const b = body?.score_b == null ? null : Number(body.score_b);
  if (!Number.isInteger(matchId))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (a !== null && (!Number.isInteger(a) || a < 0 || a > 30))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (b !== null && (!Number.isInteger(b) || b < 0 || b > 30))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  // Setting an explicit score asserts manual control — the football-data.org
  // sync must leave this row alone afterward. Clearing both back to null
  // releases the row so the sync owns it again.
  const manualOverride = a !== null || b !== null;
  await sql`
    UPDATE matches
    SET actual_score_a = ${a},
        actual_score_b = ${b},
        manual_override = ${manualOverride}
    WHERE id = ${matchId}
  `;
  return NextResponse.json({ ok: true, manual_override: manualOverride });
}
