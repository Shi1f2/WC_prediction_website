-- Tracks auto-sync timestamps and a rolling 60s call counter so we can keep
-- football-data.org usage to 85% of its 10 req/min free-tier limit.
CREATE TABLE IF NOT EXISTS sync_state (
  id                        INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_fixtures_sync_at     TIMESTAMPTZ,
  last_fixtures_sync_status TEXT,
  last_results_sync_at      TIMESTAMPTZ,
  last_results_sync_status  TEXT,
  window_started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  calls_in_window           INTEGER     NOT NULL DEFAULT 0,
  -- CAS lock: only one process at a time runs the sync. Expires automatically
  -- so a crashed process can't wedge the system.
  sync_locked_until         TIMESTAMPTZ
);

INSERT INTO sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;
