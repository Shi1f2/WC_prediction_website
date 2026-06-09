-- Test predictions for two users — paste into Supabase SQL Editor.
--
-- Inserts:
--   * eren user (if not already present)
--   * group_predictions   (top-2 picks for all 12 groups, per user)
--   * bracket_predictions (R16, QF, SF, FINAL, WINNER picks, per user)
--   * match_predictions   (score for first 6 group-stage matches by kickoff)
--   * match_market_predictions (varied market picks for those 6 matches)
--   * "Test League" owned by shift2 with eren as a member
--
-- Idempotent: uses ON CONFLICT so re-running just refreshes the picks.
-- Run after `npm run seed` (needs the 48 teams) and after the football-data
-- sync has populated `matches` (needs >=6 rows in matches).
--
-- Users used here:
--   shift2#0001  (you — must already exist via signup)
--   eren#0001    (created below with a non-functional password hash;
--                 to make eren log-in-able, replace the hash with one from:
--                 node -e "console.log(require('bcryptjs').hashSync('test1234', 10))"
--                 — run from the project root.)

BEGIN;

-- ============================================================
-- 0. Create the eren test account if missing.
-- ============================================================
-- The hash below is a placeholder that won't match any password. That's fine
-- for testing the board/leaderboard since eren never needs to sign in.
INSERT INTO users (username, discriminator, display_name, password_hash, is_admin)
VALUES (
  'eren', '0001', 'Eren',
  '$2a$10$placeholderplaceholderplaceholderplaceholderplaceholder.',
  false
)
ON CONFLICT (username, discriminator) DO NOTHING;


-- ============================================================
-- 1. Sanity check: fail loudly if either handle is missing.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE username='shift2' AND discriminator='0001') THEN
    RAISE EXCEPTION 'User shift2#0001 not found — sign up first, or edit the handle in this script.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE username='eren' AND discriminator='0001') THEN
    RAISE EXCEPTION 'User eren#0001 not found — the INSERT above should have created them.';
  END IF;
END $$;


-- ============================================================
-- 2. GROUP PREDICTIONS — top 2 per group, per user.
-- ============================================================
-- (Names match scripts/seed.ts exactly, including "Türkiye" with the dotted İ.)

-- User 1 (shift2) picks
INSERT INTO group_predictions (user_id, group_letter, position, team_id)
SELECT
  (SELECT id FROM users WHERE username='shift2' AND discriminator='0001'),
  g.group_letter, g.position, t.id
FROM (VALUES
  ('A', 1, 'Mexico'),         ('A', 2, 'South Korea'),
  ('B', 1, 'Switzerland'),    ('B', 2, 'Canada'),
  ('C', 1, 'Brazil'),         ('C', 2, 'Morocco'),
  ('D', 1, 'United States'),  ('D', 2, 'Türkiye'),
  ('E', 1, 'Germany'),        ('E', 2, 'Ecuador'),
  ('F', 1, 'Netherlands'),    ('F', 2, 'Japan'),
  ('G', 1, 'Belgium'),        ('G', 2, 'Egypt'),
  ('H', 1, 'Spain'),          ('H', 2, 'Uruguay'),
  ('I', 1, 'France'),         ('I', 2, 'Senegal'),
  ('J', 1, 'Argentina'),      ('J', 2, 'Austria'),
  ('K', 1, 'Portugal'),       ('K', 2, 'Colombia'),
  ('L', 1, 'England'),        ('L', 2, 'Croatia')
) AS g(group_letter, position, team_name)
JOIN teams t ON t.name = g.team_name
ON CONFLICT (user_id, group_letter, position)
DO UPDATE SET team_id = EXCLUDED.team_id, updated_at = NOW();

-- User 2 (eren) picks — different to make leaderboard interesting
INSERT INTO group_predictions (user_id, group_letter, position, team_id)
SELECT
  (SELECT id FROM users WHERE username='eren' AND discriminator='0001'),
  g.group_letter, g.position, t.id
FROM (VALUES
  ('A', 1, 'South Korea'),    ('A', 2, 'Mexico'),
  ('B', 1, 'Canada'),         ('B', 2, 'Switzerland'),
  ('C', 1, 'Brazil'),         ('C', 2, 'Scotland'),
  ('D', 1, 'Türkiye'),        ('D', 2, 'United States'),
  ('E', 1, 'Germany'),        ('E', 2, 'Ivory Coast'),
  ('F', 1, 'Japan'),          ('F', 2, 'Netherlands'),
  ('G', 1, 'Belgium'),        ('G', 2, 'Iran'),
  ('H', 1, 'Spain'),          ('H', 2, 'Saudi Arabia'),
  ('I', 1, 'France'),         ('I', 2, 'Norway'),
  ('J', 1, 'Argentina'),      ('J', 2, 'Algeria'),
  ('K', 1, 'Portugal'),       ('K', 2, 'DR Congo'),
  ('L', 1, 'England'),        ('L', 2, 'Ghana')
) AS g(group_letter, position, team_name)
JOIN teams t ON t.name = g.team_name
ON CONFLICT (user_id, group_letter, position)
DO UPDATE SET team_id = EXCLUDED.team_id, updated_at = NOW();


-- ============================================================
-- 3. BRACKET PREDICTIONS — R16 / QF / SF / FINAL / WINNER.
-- ============================================================
-- Stage values match POINTS.bracket in src/lib/matchScore.ts.

-- User 1 (shift2)
INSERT INTO bracket_predictions (user_id, stage, team_id)
SELECT
  (SELECT id FROM users WHERE username='shift2' AND discriminator='0001'),
  b.stage, t.id
FROM (VALUES
  -- R16 (16 teams)
  ('R16','Mexico'),('R16','South Korea'),
  ('R16','Switzerland'),('R16','Canada'),
  ('R16','Brazil'),('R16','Morocco'),
  ('R16','United States'),('R16','Türkiye'),
  ('R16','Germany'),('R16','Netherlands'),
  ('R16','Belgium'),('R16','Spain'),
  ('R16','France'),('R16','Argentina'),
  ('R16','Portugal'),('R16','England'),
  -- QF (8)
  ('QF','Brazil'),('QF','Germany'),('QF','Netherlands'),('QF','Spain'),
  ('QF','France'),('QF','Argentina'),('QF','Portugal'),('QF','England'),
  -- SF (4)
  ('SF','Brazil'),('SF','France'),('SF','Argentina'),('SF','England'),
  -- FINAL (2)
  ('FINAL','Brazil'),('FINAL','France'),
  -- WINNER (1)
  ('WINNER','France')
) AS b(stage, team_name)
JOIN teams t ON t.name = b.team_name
ON CONFLICT (user_id, stage, team_id)
DO UPDATE SET updated_at = NOW();

-- User 2 (eren)
INSERT INTO bracket_predictions (user_id, stage, team_id)
SELECT
  (SELECT id FROM users WHERE username='eren' AND discriminator='0001'),
  b.stage, t.id
FROM (VALUES
  -- R16 (16 teams)
  ('R16','South Korea'),('R16','Mexico'),
  ('R16','Canada'),('R16','Switzerland'),
  ('R16','Brazil'),('R16','Scotland'),
  ('R16','Türkiye'),('R16','United States'),
  ('R16','Germany'),('R16','Netherlands'),
  ('R16','Belgium'),('R16','Spain'),
  ('R16','France'),('R16','Argentina'),
  ('R16','Portugal'),('R16','England'),
  -- QF
  ('QF','Brazil'),('QF','Germany'),('QF','Belgium'),('QF','Spain'),
  ('QF','France'),('QF','Argentina'),('QF','Portugal'),('QF','England'),
  -- SF
  ('SF','Brazil'),('SF','Spain'),('SF','Argentina'),('SF','Portugal'),
  -- FINAL
  ('FINAL','Argentina'),('FINAL','Spain'),
  -- WINNER
  ('WINNER','Argentina')
) AS b(stage, team_name)
JOIN teams t ON t.name = b.team_name
ON CONFLICT (user_id, stage, team_id)
DO UPDATE SET updated_at = NOW();


-- ============================================================
-- 3b. Mark both brackets as "committed" so the league picks-page reveals them.
-- ============================================================
-- The /leagues/:id/picks/:userId page hides the bracket unless BOTH the member
-- AND the viewer have committed (see src/app/leagues/[id]/picks/[userId]/page.tsx:147).
-- To un-lock your own bracket later: UPDATE users SET bracket_committed_at = NULL
-- WHERE username='shift2' AND discriminator='0001';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bracket_committed_at TIMESTAMPTZ;
UPDATE users SET bracket_committed_at = NOW()
WHERE (username='shift2' AND discriminator='0001')
   OR (username='eren'   AND discriminator='0001');


-- ============================================================
-- 4. MATCH PREDICTIONS — first 6 group-stage matches by kickoff.
-- ============================================================
WITH first6 AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY kickoff_at ASC, id ASC) AS rn
  FROM matches
  WHERE stage = 'group'
  ORDER BY kickoff_at ASC, id ASC
  LIMIT 6
),
shift2 AS (SELECT id FROM users WHERE username='shift2' AND discriminator='0001'),
eren   AS (SELECT id FROM users WHERE username='eren'   AND discriminator='0001'),
-- (rn, score_a, score_b) per user.
shift2_scores(rn, sa, sb) AS (VALUES
  (1,2,1),(2,1,1),(3,3,0),(4,2,2),(5,1,0),(6,2,1)
),
eren_scores(rn, sa, sb) AS (VALUES
  (1,1,0),(2,2,2),(3,2,1),(4,0,1),(5,1,1),(6,3,2)
)
INSERT INTO match_predictions (user_id, match_id, score_a, score_b)
SELECT shift2.id, f.id, s.sa, s.sb
FROM first6 f
JOIN shift2_scores s ON s.rn = f.rn
CROSS JOIN shift2
UNION ALL
SELECT eren.id, f.id, s.sa, s.sb
FROM first6 f
JOIN eren_scores s ON s.rn = f.rn
CROSS JOIN eren
ON CONFLICT (user_id, match_id)
DO UPDATE SET score_a = EXCLUDED.score_a,
              score_b = EXCLUDED.score_b,
              updated_at = NOW();


-- ============================================================
-- 5. MARKET PREDICTIONS — varied picks across the same 6 matches.
-- ============================================================
-- Market ids + values come from src/lib/markets.ts (ou_15/25/35, btts, margin).
WITH first6 AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY kickoff_at ASC, id ASC) AS rn
  FROM matches
  WHERE stage = 'group'
  ORDER BY kickoff_at ASC, id ASC
  LIMIT 6
),
shift2 AS (SELECT id FROM users WHERE username='shift2' AND discriminator='0001'),
eren   AS (SELECT id FROM users WHERE username='eren'   AND discriminator='0001'),
shift2_markets(rn, market, pick) AS (VALUES
  (1,'ou_25','over'),    (1,'btts','yes'),   (1,'margin','a_by_1'),
  (2,'ou_25','over'),    (2,'btts','yes'),
  (3,'ou_35','over'),    (3,'margin','a_by_3plus'),
  (4,'ou_25','over'),    (4,'btts','yes'),   (4,'margin','draw'),
  (5,'ou_15','under'),   (5,'btts','no'),
  (6,'ou_25','over'),    (6,'margin','a_by_1')
),
eren_markets(rn, market, pick) AS (VALUES
  (1,'ou_15','over'),    (1,'btts','no'),
  (2,'ou_35','under'),   (2,'margin','draw'),
  (3,'ou_25','over'),    (3,'btts','yes'),   (3,'margin','a_by_1'),
  (4,'ou_15','under'),   (4,'btts','no'),
  (5,'ou_25','under'),   (5,'margin','draw'),
  (6,'ou_35','over'),    (6,'btts','yes'),   (6,'margin','b_by_1')
)
INSERT INTO match_market_predictions (user_id, match_id, market, pick)
SELECT shift2.id, f.id, m.market, m.pick
FROM first6 f
JOIN shift2_markets m ON m.rn = f.rn
CROSS JOIN shift2
UNION ALL
SELECT eren.id, f.id, m.market, m.pick
FROM first6 f
JOIN eren_markets m ON m.rn = f.rn
CROSS JOIN eren
ON CONFLICT (user_id, match_id, market)
DO UPDATE SET pick = EXCLUDED.pick,
              updated_at = NOW();


-- ============================================================
-- 6. FAKE LEAGUE — owned by shift2, with eren as a member.
-- ============================================================
-- Idempotent: looks up an existing league named 'Test League' owned by shift2
-- before inserting, so re-running won't create duplicates.
WITH owner AS (
  SELECT id FROM users WHERE username='shift2' AND discriminator='0001'
),
existing AS (
  SELECT l.id FROM leagues l, owner
  WHERE l.name = 'Test League' AND l.owner_id = owner.id
  LIMIT 1
),
inserted AS (
  INSERT INTO leagues (name, owner_id)
  SELECT 'Test League', owner.id
  FROM owner
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  RETURNING id
),
league AS (
  SELECT id FROM existing
  UNION ALL
  SELECT id FROM inserted
)
INSERT INTO league_members (league_id, user_id)
SELECT league.id, u.id
FROM league
CROSS JOIN users u
WHERE (u.username='shift2' AND u.discriminator='0001')
   OR (u.username='eren'   AND u.discriminator='0001')
ON CONFLICT (league_id, user_id) DO NOTHING;


-- ============================================================
-- 7. Quick verification — counts per user.
-- ============================================================
SELECT
  u.username || '#' || u.discriminator AS handle,
  (SELECT COUNT(*) FROM group_predictions   WHERE user_id = u.id) AS groups,
  (SELECT COUNT(*) FROM bracket_predictions WHERE user_id = u.id) AS bracket,
  (SELECT COUNT(*) FROM match_predictions   WHERE user_id = u.id) AS matches,
  (SELECT COUNT(*) FROM match_market_predictions WHERE user_id = u.id) AS markets
FROM users u
WHERE (u.username='shift2' AND u.discriminator='0001')
   OR (u.username='eren'   AND u.discriminator='0001');

COMMIT;
