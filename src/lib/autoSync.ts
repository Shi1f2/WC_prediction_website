// Lazy auto-sync orchestrator.
//
// Called from server components on cache-busted page loads. Decides whether to
// refresh fixtures or results from football-data.org based on staleness and a
// match-window heuristic, while staying under 85% of the 10 req/min free-tier
// limit (= 8 req/min hard cap, enforced via a DB-level rolling-window counter).
//
// Concurrent requests serialize via a Postgres advisory lock — only one
// process per app instance runs the network calls; others fast-skip.

import { sql } from "@/lib/db";
import { runFixturesSync, runResultsSync } from "@/lib/sync";
import { FootballDataError } from "@/lib/footballData";

// Rolling-window rate limit. 10/min is the free-tier max; 85% = 8.5, floor 8.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_CALLS = 8;

// CAS lock auto-expires so a crashed process can't wedge sync forever.
// Long enough to absorb the slowest expected fixtures sync (two API calls +
// many small upserts).
const LOCK_TTL_SECONDS = 90;

// Cadence (ms). Pages award fresh data when stale; otherwise the call is a no-op.
const FIXTURES_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h
const RESULTS_LIVE_INTERVAL_MS = 60_000;          // 1 min during match window
const RESULTS_IDLE_INTERVAL_MS = 20 * 60_000;     // 20 min otherwise

// Match window: kickoff in [now - 3h, now + 2h] counts as "live".
const LIVE_BEFORE_MS = 2 * 60 * 60 * 1000;
const LIVE_AFTER_MS  = 3 * 60 * 60 * 1000;

type SyncStateRow = {
  last_fixtures_sync_at: Date | null;
  last_results_sync_at: Date | null;
  window_started_at: Date;
  calls_in_window: number;
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
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE kickoff_at BETWEEN
        now() - (${LIVE_AFTER_MS / 1000} || ' seconds')::INTERVAL
        AND now() + (${LIVE_BEFORE_MS / 1000} || ' seconds')::INTERVAL
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

// Increments the rolling-window counter and returns the remaining budget.
// Resets the window when it has expired. Returns -1 if the cap is hit.
async function reserveCalls(n: number): Promise<number> {
  const rows = await sql<{ allowed: boolean; remaining: number }[]>`
    WITH cur AS (
      SELECT
        CASE
          WHEN now() - window_started_at >= INTERVAL '60 seconds' THEN 0
          ELSE calls_in_window
        END AS used,
        CASE
          WHEN now() - window_started_at >= INTERVAL '60 seconds' THEN now()
          ELSE window_started_at
        END AS win_start
      FROM sync_state WHERE id = 1
    ),
    upd AS (
      UPDATE sync_state s
      SET calls_in_window = cur.used + ${n},
          window_started_at = cur.win_start
      FROM cur
      WHERE s.id = 1
        AND cur.used + ${n} <= ${RATE_MAX_CALLS}
      RETURNING ${RATE_MAX_CALLS} - s.calls_in_window AS remaining
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
           window_started_at, calls_in_window
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
      console.warn(`autoSync ${label}: football-data error`, e.status, e.message);
    } else {
      console.warn(`autoSync ${label}: failed`, e);
    }
  }
}

export async function maybeAutoSync(): Promise<AutoSyncOutcome> {
  if (!process.env.FOOTBALL_DATA_TOKEN) {
    return {
      ran_fixtures: false,
      ran_results: false,
      skipped_reason: "no FOOTBALL_DATA_TOKEN",
      rate_remaining: RATE_MAX_CALLS,
      last_fixtures_sync_at: null,
      last_results_sync_at: null,
    };
  }

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
    calls_in_window: state?.calls_in_window ?? 0,
    window_started_at: state?.window_started_at?.toISOString() ?? null,
    rate_max_per_minute: RATE_MAX_CALLS,
    rate_window_ms: RATE_WINDOW_MS,
    fixtures_interval_ms: FIXTURES_INTERVAL_MS,
    results_live_interval_ms: RESULTS_LIVE_INTERVAL_MS,
    results_idle_interval_ms: RESULTS_IDLE_INTERVAL_MS,
  };
}

