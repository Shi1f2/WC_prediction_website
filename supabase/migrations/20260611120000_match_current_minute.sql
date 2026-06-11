-- Real in-play minute from football-data.org (e.g. 38 at the 38th minute).
-- Beats computing it from wall-clock elapsed since kickoff_at, which drifts
-- whenever the actual kickoff is delayed or stoppages occur.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_minute INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS injury_time INTEGER;
