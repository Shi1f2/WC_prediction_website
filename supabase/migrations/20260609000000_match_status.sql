-- Raw football-data.org status (SCHEDULED, IN_PLAY, FINISHED, AWARDED, ...).
-- Lets the UI distinguish "live, score updating" from "final, locked in".
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT;
