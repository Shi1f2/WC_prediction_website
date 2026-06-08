-- Run this once in the Supabase SQL Editor before deploying.
-- It creates the tables; row-level security is intentionally disabled because
-- this app uses its own session-cookie auth on the server side, not Supabase Auth.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id            SERIAL PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  code          TEXT NOT NULL,
  flag          TEXT NOT NULL,
  group_letter  TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id              SERIAL PRIMARY KEY,
  stage           TEXT NOT NULL,
  group_letter    TEXT,
  team_a_id       INTEGER REFERENCES teams(id),
  team_b_id       INTEGER REFERENCES teams(id),
  team_a_label    TEXT,
  team_b_label    TEXT,
  kickoff_at      TIMESTAMPTZ NOT NULL,
  venue           TEXT,
  actual_score_a  INTEGER,
  actual_score_b  INTEGER,
  order_index     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS match_predictions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  score_a     INTEGER NOT NULL,
  score_b     INTEGER NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

CREATE TABLE IF NOT EXISTS group_predictions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_letter  TEXT NOT NULL,
  position      INTEGER NOT NULL,
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, group_letter, position)
);

CREATE TABLE IF NOT EXISTS group_results (
  group_letter  TEXT NOT NULL,
  position      INTEGER NOT NULL,
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  PRIMARY KEY (group_letter, position)
);

CREATE TABLE IF NOT EXISTS bracket_predictions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL,
  team_id     INTEGER NOT NULL REFERENCES teams(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, stage, team_id)
);

CREATE TABLE IF NOT EXISTS bracket_results (
  stage    TEXT NOT NULL,
  team_id  INTEGER NOT NULL REFERENCES teams(id),
  PRIMARY KEY (stage, team_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_match_preds_user ON match_predictions(user_id);
