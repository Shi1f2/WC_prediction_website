-- Links local teams + matches to their football-data.org IDs so admin "Sync"
-- buttons can upsert by stable external ID instead of fuzzy name matching.
ALTER TABLE teams   ADD COLUMN IF NOT EXISTS api_team_id    INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS api_fixture_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_api_team_id      ON teams   (api_team_id)    WHERE api_team_id    IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_api_fixture_id ON matches (api_fixture_id) WHERE api_fixture_id IS NOT NULL;
