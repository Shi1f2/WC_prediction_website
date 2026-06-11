import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchWcMatches, FootballDataError } from "@/lib/footballData";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Debug-only: returns the raw football-data.org match list alongside our DB
// rows so you can compare what the API is reporting vs. what we've stored.
// Helpful for diagnosing "match is live in real life but our UI shows
// scheduled" — usually it's the API itself that's behind, or the api_fixture_id
// link is missing.
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Match what fetchWcMatches uses by default, so the timestamp below reflects
  // the same window the autoSync polls on.
  const dateFrom = "2026-06-01";
  const dateTo = "2026-07-31";
  const startedAt = Date.now();

  try {
    const apiMatches = await fetchWcMatches({ dateFrom, dateTo });
    const fetchedAt = new Date().toISOString();
    const fetchDurationMs = Date.now() - startedAt;
    const dbMatches = await sql<
      {
        id: number;
        api_fixture_id: number | null;
        status: string | null;
        actual_score_a: number | null;
        actual_score_b: number | null;
        current_minute: number | null;
        kickoff_at: Date;
        team_a_name: string | null;
        team_b_name: string | null;
      }[]
    >`
      SELECT m.id, m.api_fixture_id, m.status, m.actual_score_a,
             m.actual_score_b, m.current_minute, m.kickoff_at,
             ta.name AS team_a_name, tb.name AS team_b_name
      FROM matches m
      LEFT JOIN teams ta ON ta.id = m.team_a_id
      LEFT JOIN teams tb ON tb.id = m.team_b_id
      ORDER BY m.kickoff_at
    `;

    const slim = apiMatches.map((m) => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      minute: m.minute ?? null,
      injuryTime: m.injuryTime ?? null,
      stage: m.stage,
      group: m.group,
      homeTeam: m.homeTeam?.name ?? null,
      awayTeam: m.awayTeam?.name ?? null,
      score: m.score?.fullTime ?? null,
    }));

    return NextResponse.json({
      fetched_at: fetchedAt,
      fetch_duration_ms: fetchDurationMs,
      server_now: new Date().toISOString(),
      requested_window: { dateFrom, dateTo },
      api_count: apiMatches.length,
      api_matches: slim,
      db_count: dbMatches.length,
      db_matches: dbMatches,
    });
  } catch (e) {
    if (e instanceof FootballDataError) {
      return NextResponse.json(
        { error: e.message, status: e.status, retry_after: e.retryAfter },
        { status: e.status === 429 ? 429 : 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
