import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

const VALID_STAGES = new Set(["group", "r32", "r16", "qf", "sf", "third", "final"]);

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const stage = String(body?.stage ?? "");
  if (!VALID_STAGES.has(stage))
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  const teamAId = body?.team_a_id ? Number(body.team_a_id) : null;
  const teamBId = body?.team_b_id ? Number(body.team_b_id) : null;
  const labelA = body?.team_a_label ? String(body.team_a_label) : null;
  const labelB = body?.team_b_label ? String(body.team_b_label) : null;
  const kickoff = body?.kickoff_at ? String(body.kickoff_at) : null;
  const venue = body?.venue ? String(body.venue) : null;
  if (!kickoff)
    return NextResponse.json({ error: "kickoff_at required" }, { status: 400 });

  await sql`
    INSERT INTO matches
      (stage, team_a_id, team_b_id, team_a_label, team_b_label, kickoff_at, venue)
    VALUES
      (${stage}, ${teamAId}, ${teamBId}, ${labelA}, ${labelB}, ${kickoff}, ${venue})
  `;
  return NextResponse.json({ ok: true });
}
