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
  const letter = String(body?.group_letter ?? "");
  if (!/^[A-L]$/.test(letter))
    return NextResponse.json({ error: "Invalid group" }, { status: 400 });
  const positions = body?.positions ?? {};
  await sql.begin(async (tx) => {
    await tx`DELETE FROM group_results WHERE group_letter = ${letter}`;
    for (const pos of [1, 2, 3, 4]) {
      const teamId = positions[pos] || positions[String(pos)];
      if (teamId) {
        await tx`
          INSERT INTO group_results (group_letter, position, team_id)
          VALUES (${letter}, ${pos}, ${Number(teamId)})
        `;
      }
    }
  });
  return NextResponse.json({ ok: true });
}
