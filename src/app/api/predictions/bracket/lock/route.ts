import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotent: once committed, it stays. We don't overwrite the timestamp.
  const result = await sql<{ bracket_committed_at: Date | null }[]>`
    UPDATE users
    SET bracket_committed_at = COALESCE(bracket_committed_at, NOW())
    WHERE id = ${user.id}
    RETURNING bracket_committed_at
  `;

  return NextResponse.json({
    ok: true,
    committed_at: result[0]?.bracket_committed_at?.toISOString() ?? null,
  });
}
