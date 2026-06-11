-- Switch from football-data.org to api-football.com (api-sports.io v3).
-- The api_fixture_id column held football-data fixture IDs; api-football
-- assigns its own numeric IDs that won't match, so we add a dedicated column
-- rather than overwrite (cheap insurance against accidental rollback).
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS api_football_fixture_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_matches_api_football_fixture_id
  ON matches(api_football_fixture_id);

-- Same story for teams: api-football team IDs differ from football-data's.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS api_football_team_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_teams_api_football_team_id
  ON teams(api_football_team_id);

-- Daily-budget counter for api-football's free tier (100 req/day, vs.
-- football-data's 10 req/min). The legacy calls_in_window column stays for
-- now in case we ever want to do per-minute throttling on a paid tier.
ALTER TABLE sync_state
  ADD COLUMN IF NOT EXISTS calls_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS day_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
