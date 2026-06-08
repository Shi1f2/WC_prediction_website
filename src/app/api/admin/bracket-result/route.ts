import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

const LIMITS: Record<string, number> = { R16: 16, QF: 8, SF: 4, FINAL: 2, WINNER: 1 };

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await sql.begin(async (tx) => {
    await tx`DELETE FROM bracket_results`;
    for (const [stage, limit] of Object.entries(LIMITS)) {
      const raw = body[stage];
      if (!Array.isArray(raw)) continue;
      const ids = [...new Set(raw.map(Number))]
        .filter((n) => Number.isInteger(n))
        .slice(0, limit);
      for (const id of ids) {
        await tx`
          INSERT INTO bracket_results (stage, team_id) VALUES (${stage}, ${id})
        `;
      }
    }
  });
  return NextResponse.json({ ok: true });
}
