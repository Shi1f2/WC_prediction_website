import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runResultsSync } from "@/lib/sync";
import { FootballDataError } from "@/lib/footballData";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const report = await runResultsSync();
    await sql`
      UPDATE sync_state
      SET last_results_sync_at = now(), last_results_sync_status = 'manual ok'
      WHERE id = 1
    `;
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    if (e instanceof FootballDataError) {
      return NextResponse.json(
        { error: e.message, retry_after: e.retryAfter },
        { status: e.status === 429 ? 429 : 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
