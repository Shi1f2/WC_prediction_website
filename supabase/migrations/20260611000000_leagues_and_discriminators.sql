-- Discord-style user handles + private friend leagues.
--
-- The leaderboard used to be global. We now scope it to "leagues" the user
-- creates and invites friends to. Usernames are no longer globally unique;
-- instead each user gets a 4-digit discriminator and (username, discriminator)
-- is the unique handle (e.g. arda#7421) used for invites.

ALTER TABLE users ADD COLUMN IF NOT EXISTS discriminator CHAR(4);

-- Existing users predate discriminators. Usernames were globally unique
-- before this migration, so '0001' is a safe collision-free backfill.
UPDATE users SET discriminator = '0001' WHERE discriminator IS NULL;

ALTER TABLE users ALTER COLUMN discriminator SET NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_handle_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_handle_key UNIQUE (username, discriminator);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leagues (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_members (
  league_id   INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS league_invites (
  id          SERIAL PRIMARY KEY,
  league_id   INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  inviter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_league_members_user   ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_invites_invitee ON league_invites(invitee_id);
