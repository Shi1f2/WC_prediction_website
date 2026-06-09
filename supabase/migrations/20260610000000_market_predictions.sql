-- Betting-style optional markets per match (Over/Under, BTTS, Winning margin).
-- One row per (user, match, market). Pick is the user's chosen option value;
-- the catalog of valid markets/values + points lives in src/lib/markets.ts
-- so it can stay in sync with the UI without a migration.
CREATE TABLE IF NOT EXISTS match_market_predictions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  market      TEXT NOT NULL,
  pick        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id, market)
);

CREATE INDEX IF NOT EXISTS idx_market_preds_match ON match_market_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_market_preds_user  ON match_market_predictions(user_id);
