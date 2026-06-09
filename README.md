# World Cup 2026 — Friends Predictions

A small Next.js app for running a **World Cup prediction game with your friends**.
Everyone signs up, picks scores for every match, picks who finishes 1st/2nd in
each group, and fills out a bracket all the way to the champion. The app pulls
fixtures and live results from **football-data.org** automatically and scores
predictions as games finish, so the leaderboard updates while you're watching.

You host it yourself — on your own computer for a small group, or push it to a
free Vercel + Supabase setup so friends can use it from anywhere.

## What it does

- Sign up / log in (cookie sessions, bcrypt password hashes)
- Pick a score for every match (group stage + knockout) at `/matches`
- Pick group winners + runners-up and the full knockout bracket at `/board`
- Auto-locking: predictions for a match lock at kickoff
- **Auto-sync from football-data.org**: fixtures refresh every ~6h, results
  every ~20 min (every ~60 s during a live match window). Rate-limited to stay
  under the free tier's 10 req/min cap.
- Admin panel to manually trigger a sync, fix up edge cases, and override
  results if needed
- Live leaderboard at `/`

### Scoring

| What you got right | Points |
| --- | --- |
| Exact match score | 5 |
| Correct winner + goal difference | 3 |
| Correct winner only | 2 |
| Group: team in exact position (1st/2nd) | 4 |
| Group: team in top 2 but wrong order | 2 |
| Each correct quarterfinalist | 2 |
| Each correct semifinalist | 4 |
| Each correct finalist | 8 |
| Champion | 16 |

## Set it up on your own computer

### Prerequisites

- **Node.js 18+** — https://nodejs.org (LTS is fine)
- **Git** — https://git-scm.com
- A free **Supabase** account for the database — https://supabase.com
  (Any Postgres works — just point `DATABASE_URL` at it.)
- A free **football-data.org** API token — https://www.football-data.org/client/register
  (Free tier: 10 requests/min. The app's auto-sync stays well under that.)

### 1. Get the code

```powershell
git clone https://github.com/<you>/wc-predictions.git
cd wc-predictions
npm install
```

### 2. Create the database

1. Go to https://supabase.com → **New project**. Free tier is fine. Pick a
   strong DB password and save it.
2. Wait ~1 minute for it to provision.
3. Open the **SQL Editor** → **New query**, paste the entire contents of
   [`schema.sql`](./schema.sql), and run it.
4. Then run each migration in [`supabase/migrations/`](./supabase/migrations/)
   in filename order — they add the football-data.org integration columns and
   the sync-state bookkeeping table.
5. Open **Project Settings → Database → Connection string**.
   - Pick **Transaction** mode (port `6543`) — the pooler URL, required for
     serverless and fine for local dev too.
   - Copy the URI. It looks like:
     ```
     postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
     ```

### 3. Configure your env vars

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Fill in:

- `DATABASE_URL` — the Supabase URI from step 2.
- `FOOTBALL_DATA_TOKEN` — your token from football-data.org. Server-only,
  never exposed to the browser. If you leave it blank the app still runs, but
  fixtures and results won't auto-update — you'd be entering everything by
  hand in the admin panel.

### 4. Seed the teams and group-stage fixtures

```powershell
npm run seed
```

This inserts 48 teams and 72 group-stage matches with placeholder kickoff
times. As soon as the app talks to football-data.org for the first time, the
auto-sync replaces these placeholders with the real draw, real teams, and real
kickoff times — and links each row to the API so future results land
automatically.

### 5. Run the app

```powershell
npm run dev
```

Open http://localhost:3000. Sign up to create your account, then promote
yourself to admin from another terminal:

```powershell
npm run make-admin <your-username>
```

Refresh the page — you'll now see an **Admin** link in the nav. Hitting most
pages will lazily kick off a background sync from football-data.org (rate
limited, non-blocking), so within a minute or two the real fixture data
should appear.

If your friends are on the same Wi-Fi, share your local IP (e.g.
`http://192.168.1.42:3000`) so they can join. For anything bigger, deploy it
(see below).

### 6. Run the league

- `/` — live leaderboard.
- `/predict` — hub showing your progress in each prediction area.
- `/matches` — score predictions for every match.
- `/board` — pick group standings (1st/2nd in each of the 12 groups) and fill
  out the full knockout bracket.
- `/admin` — trigger a manual sync from football-data.org, override results,
  add knockout matches if the API hasn't published them yet, etc. Most of the
  time you won't need to touch it — auto-sync handles the rest.

Predictions lock automatically at kickoff for each match, so late entries
can't cheat off real results.

## Deploy so friends can use it from anywhere (optional)

The local setup above works for a LAN party. To put it on the internet:

1. Push the repo to GitHub (private is fine).
2. Go to https://vercel.com/new → import the repo. Framework: **Next.js**
   (auto-detected, no build setting changes needed).
3. Under **Environment Variables**, add the same `DATABASE_URL` and
   `FOOTBALL_DATA_TOKEN` you used locally.
4. Click **Deploy**. You'll get a URL like `https://wc-predictions-xyz.vercel.app`
   — send it to your friends.

Both local and deployed copies talk to the same Supabase DB by default, so you
can manage results from either one. Auto-sync runs on whichever instance gets
traffic — a Postgres advisory lock keeps multiple processes from hitting the
API at the same time.

(If you ever need to promote someone else to admin, run
`npm run make-admin <username>` locally — it uses the same `.env.local`.)

## File layout

```
schema.sql                       # Initial schema — run once in Supabase SQL editor
supabase/migrations/             # Run after schema.sql, in filename order
scripts/seed.ts                  # Inserts 48 teams + 72 group matches (placeholders)
scripts/make-admin.ts            # Promotes a user to admin

src/lib/db.ts                    # Postgres client (lazy-initialized)
src/lib/auth.ts                  # Signup, login, sessions, cookies
src/lib/scoring.ts               # Leaderboard computation
src/lib/footballData.ts          # Thin football-data.org v4 wrapper
src/lib/sync.ts                  # Fixtures + results sync logic
src/lib/autoSync.ts              # Rate-limited lazy auto-sync orchestrator

src/components/                  # Shared UI (BoardClient, BoardBracket, Flag, ...)
src/app/page.tsx                 # Leaderboard
src/app/predict/                 # Prediction hub
src/app/matches/                 # Match score predictions
src/app/board/                   # Group standings + knockout bracket picker
src/app/admin/                   # Admin panel (sync, results overrides, etc.)
src/app/api/                     # Route handlers
```

## Notes on fixture data and the API

The seed file is a placeholder — it inserts 48 generic team names and a
6-match round-robin per group with synthetic kickoff times. Once
`FOOTBALL_DATA_TOKEN` is set, the auto-sync replaces all of that with the real
draw and schedule the next time a page is rendered. The sync matches teams by
normalized name (with a small alias table for cases like
"Côte d'Ivoire" / "Ivory Coast"), links them to the API by ID, and from then
on tracks all updates by that ID.

If a team in the API doesn't match anything in your DB, the admin sync report
shows it as an **orphan** so you can rename it manually. Knockout matches
appear in the API once the draw publishes them; until then, `/admin` lets you
add them by hand.
