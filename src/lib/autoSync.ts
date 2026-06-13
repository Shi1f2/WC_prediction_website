// Lazy auto-sync orchestrator.
//
// Called from server components on cache-busted page loads. Decides whether to
// refresh fixtures or results from thesportsdb.com based on staleness and a
// match-window heuristic. thesportsdb's free tier has no hard daily quota,
// just a "be polite" guideline — we still cap calls/day defensively.
//
// Concurrent requests serialize via a Postgres advisory lock — only one
// process per app instance runs the network calls; others fast-skip.

import { sql } from "@/lib/db";
import { runFixturesSync, runResultsSync } from "@/lib/sync";
import { FootballDataError } from "@/lib/footballData";

// Defensive daily cap. thesportsdb doesn't publish a strict number, but
// keeping it under 200/day comfortably stays in "polite" territory.
const RATE_MAX_CALLS = 200;

// CAS lock auto-expires so a crashed process can't wedge sync forever.
const LOCK_TTL_SECONDS = 90;

// Cadence (ms). Live window polls every 10 minutes per the user's spec —
// outside the live window we essentially stop polling for results, and only
// re-fetch fixtures once a day (the draw doesn't change).
const FIXTURES_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24h
const RESULTS_LIVE_INTERVAL_MS = 10 * 60_000;      // 10 min during match window
const RESULTS_IDLE_INTERVAL_MS = 12 * 60 * 60_000; // 12h otherwise — effectively idle

// Match window: kickoff in [now - 3h, now + 2h] counts as "live".
const LIVE_BEFORE_MS = 2 * 60 * 60 * 1000;
const LIVE_AFTER_MS  = 3 * 60 * 60 * 1000;

type SyncStateRow = {
  last_fixtures_sync_at: Date | null;
  last_results_sync_at: Date | null;
  day_started_at: Date;
  calls_today: number;
};

export type AutoSyncOutcome = {
  ran_fixtures: boolean;
  ran_results: boolean;
  skipped_reason?: string;
  rate_remaining: number;
  last_fixtures_sync_at: string | null;
  last_results_sync_at: string | null;
};

async function isInLiveWindow(): Promise<boolean> {
  // "Live" = either kickoff is within the polling window, OR a match is still
  // flagged in-play / halftime / ET / pens in the DB. The status check matters
  // because a knockout match in extra-time + penalties can run 3h+ past
  // kickoff, falling outside the kickoff-based window — without it, autoSync
  // would drop to the 12h IDLE interval and freeze the score mid-match until
  // someone manually triggered a sync.
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE
        status IN ('IN_PLAY','PAUSED','EXTRA_TIME','PENALTY_SHOOTOUT')
        OR kickoff_at BETWEEN
          now() - (${LIVE_AFTER_MS / 1000} || ' seconds')::INTERVAL
          AND now() + (${LIVE_BEFORE_MS / 1000} || ' seconds')::INTERVAL
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

// Increments the per-day counter and returns the remaining budget. Resets
// the counter when the calendar day rolls over (UTC). Returns -1 if the cap
// is hit. api-football resets at 00:00 UTC.
async function reserveCalls(n: number): Promise<number> {
  const rows = await sql<{ allowed: boolean; remaining: number }[]>`
    WITH cur AS (
      SELECT
        CASE
          WHEN date_trunc('day', day_started_at AT TIME ZONE 'UTC')
             < date_trunc('day', now() AT TIME ZONE 'UTC')
          THEN 0
          ELSE calls_today
        END AS used,
        CASE
          WHEN date_trunc('day', day_started_at AT TIME ZONE 'UTC')
             < date_trunc('day', now() AT TIME ZONE 'UTC')
          THEN now()
          ELSE day_started_at
        END AS day_start
      FROM sync_state WHERE id = 1
    ),
    upd AS (
      UPDATE sync_state s
      SET calls_today = cur.used + ${n},
          day_started_at = cur.day_start
      FROM cur
      WHERE s.id = 1
        AND cur.used + ${n} <= ${RATE_MAX_CALLS}
      RETURNING ${RATE_MAX_CALLS} - s.calls_today AS remaining
    )
    SELECT
      (SELECT count(*) FROM upd) > 0 AS allowed,
      COALESCE((SELECT remaining FROM upd), ${RATE_MAX_CALLS} - (SELECT used FROM cur)) AS remaining
  `;
  const r = rows[0];
  if (!r || !r.allowed) return -1;
  return r.remaining;
}

async function getSyncState(): Promise<SyncStateRow | null> {
  const rows = await sql<SyncStateRow[]>`
    SELECT last_fixtures_sync_at, last_results_sync_at,
           day_started_at, calls_today
    FROM sync_state WHERE id = 1
  `;
  return rows[0] ?? null;
}

async function markFixtures(status: string) {
  await sql`
    UPDATE sync_state
    SET last_fixtures_sync_at = now(),
        last_fixtures_sync_status = ${status}
    WHERE id = 1
  `;
}

async function markResults(status: string) {
  await sql`
    UPDATE sync_state
    SET last_results_sync_at = now(),
        last_results_sync_status = ${status}
    WHERE id = 1
  `;
}

// Wrap each section so a failure in one section doesn't kill the other.
async function tryRun(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof FootballDataError) {
      console.warn(`autoSync ${label}: thesportsdb error`, e.status, e.message);
    } else {
      console.warn(`autoSync ${label}: failed`, e);
    }
  }
}

export async function maybeAutoSync(): Promise<AutoSyncOutcome> {
  // thesportsdb's free public key "3" works without signup, so no env guard
  // here — SPORTSDB_KEY is optional (only needed for Patreon dedicated keys).

  // DB-side compare-and-swap lock. Works across pooled/serverless connections;
  // the TTL guarantees we never wedge if a process dies mid-sync.
  const lockRows = await sql<{ id: number }[]>`
    UPDATE sync_state
    SET sync_locked_until =
      now() + (${LOCK_TTL_SECONDS} || ' seconds')::INTERVAL
    WHERE id = 1
      AND (sync_locked_until IS NULL OR sync_locked_until < now())
    RETURNING id
  `;
  const gotLock = lockRows.length > 0;

  if (!gotLock) {
    const state = await getSyncState();
    return {
      ran_fixtures: false,
      ran_results: false,
      skipped_reason: "another sync in progress",
      rate_remaining: RATE_MAX_CALLS,
      last_fixtures_sync_at: state?.last_fixtures_sync_at?.toISOString() ?? null,
      last_results_sync_at: state?.last_results_sync_at?.toISOString() ?? null,
    };
  }

  let ranFixtures = false;
  let ranResults = false;
  let skippedReason: string | undefined;
  let rateRemaining = RATE_MAX_CALLS;

  try {
    const state = await getSyncState();
    const now = Date.now();
    const live = await isInLiveWindow();

    const fixturesAge = state?.last_fixtures_sync_at
      ? now - state.last_fixtures_sync_at.getTime()
      : Infinity;
    const resultsAge = state?.last_results_sync_at
      ? now - state.last_results_sync_at.getTime()
      : Infinity;

    const fixturesStale = fixturesAge >= FIXTURES_INTERVAL_MS;
    const resultsInterval = live
      ? RESULTS_LIVE_INTERVAL_MS
      : RESULTS_IDLE_INTERVAL_MS;
    const resultsStale = resultsAge >= resultsInterval;

    if (!fixturesStale && !resultsStale) {
      skippedReason = live ? "fresh (live window)" : "fresh (idle)";
    }

    // Fixtures (2 calls) first — results uses the same endpoint, so a fresh
    // fixtures run also implicitly refreshes scores.
    if (fixturesStale) {
      rateRemaining = await reserveCalls(2);
      if (rateRemaining < 0) {
        skippedReason = "rate cap hit";
      } else {
        await tryRun("fixtures", async () => {
          await runFixturesSync();
          ranFixtures = true;
          await markFixtures("ok");
        });
        if (!ranFixtures) await markFixtures("error");
      }
    }

    // Skip the results sync if fixtures just ran — it already pulled matches.
    if (!ranFixtures && resultsStale) {
      rateRemaining = await reserveCalls(1);
      if (rateRemaining < 0) {
        skippedReason = "rate cap hit";
      } else {
        await tryRun("results", async () => {
          await runResultsSync();
          ranResults = true;
          await markResults("ok");
        });
        if (!ranResults) await markResults("error");
      }
    }

    const final = await getSyncState();
    return {
      ran_fixtures: ranFixtures,
      ran_results: ranResults,
      skipped_reason: skippedReason,
      rate_remaining: rateRemaining,
      last_fixtures_sync_at: final?.last_fixtures_sync_at?.toISOString() ?? null,
      last_results_sync_at: final?.last_results_sync_at?.toISOString() ?? null,
    };
  } finally {
    await sql`
      UPDATE sync_state SET sync_locked_until = NULL WHERE id = 1
    `.catch(() => {});
  }
}

// Page-component-safe wrapper: never throws, never blocks render past 4s.
export async function autoSyncForPage(): Promise<void> {
  const deadline = new Promise<void>((resolve) =>
    setTimeout(resolve, 4000),
  );
  try {
    await Promise.race([maybeAutoSync().then(() => undefined), deadline]);
  } catch {
    // Swallow — page rendering must not depend on the external API.
  }
}

export async function readSyncState() {
  const state = await getSyncState();
  return {
    last_fixtures_sync_at: state?.last_fixtures_sync_at?.toISOString() ?? null,
    last_results_sync_at: state?.last_results_sync_at?.toISOString() ?? null,
    // Field names kept from the old per-minute rate model so AdminSync.tsx
    // doesn't need rewriting. Values now mean per-day instead of per-minute.
    calls_in_window: state?.calls_today ?? 0,
    window_started_at: state?.day_started_at?.toISOString() ?? null,
    rate_max_per_minute: RATE_MAX_CALLS,
    rate_window_ms: 24 * 60 * 60 * 1000,
    fixtures_interval_ms: FIXTURES_INTERVAL_MS,
    results_live_interval_ms: RESULTS_LIVE_INTERVAL_MS,
    results_idle_interval_ms: RESULTS_IDLE_INTERVAL_MS,
  };
}

