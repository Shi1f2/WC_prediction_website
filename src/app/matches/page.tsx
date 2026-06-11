import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import MatchRow from "./MatchRow";
import DemoDay from "./DemoDay";
import { autoSyncForPage } from "@/lib/autoSync";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type MatchRowDb = {
  id: number;
  stage: string;
  group_letter: string | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_name: string | null;
  team_a_flag: string | null;
  team_a_label: string | null;
  team_b_name: string | null;
  team_b_flag: string | null;
  team_b_label: string | null;
  kickoff_at: string;
  actual_score_a: number | null;
  actual_score_b: number | null;
  status: string | null;
  current_minute: number | null;
  injury_time: number | null;
  pred_a: number | null;
  pred_b: number | null;
};

export default async function MatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await autoSyncForPage();

  const showDemo = (await cookies()).get("match_demo")?.value === "1";

  const rows = await sql<MatchRowDb[]>`
    SELECT
      m.id, m.stage, m.group_letter,
      m.team_a_id, m.team_b_id,
      ta.name AS team_a_name, ta.flag AS team_a_flag, m.team_a_label,
      tb.name AS team_b_name, tb.flag AS team_b_flag, m.team_b_label,
      to_char(m.kickoff_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS kickoff_at,
      m.actual_score_a, m.actual_score_b, m.status,
      m.current_minute, m.injury_time,
      mp.score_a AS pred_a, mp.score_b AS pred_b
    FROM matches m
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
    LEFT JOIN match_predictions mp ON mp.match_id = m.id AND mp.user_id = ${user.id}
    ORDER BY m.kickoff_at, m.id
  `;

  const marketRows = await sql<
    { match_id: number; market: string; pick: string }[]
  >`
    SELECT match_id, market, pick
    FROM match_market_predictions
    WHERE user_id = ${user.id}
  `;
  const marketsByMatch = new Map<number, Record<string, string>>();
  for (const r of marketRows) {
    const cur = marketsByMatch.get(r.match_id) ?? {};
    cur[r.market] = r.pick;
    marketsByMatch.set(r.match_id, cur);
  }

  const byDay = new Map<string, MatchRowDb[]>();
  for (const r of rows) {
    const day = r.kickoff_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(r);
    byDay.set(day, arr);
  }
  const sortedDays = Array.from(byDay.keys()).sort();

  const todayUtc = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display-italic mb-2 text-4xl uppercase text-on-background sm:text-5xl">
          Match <span className="text-secondary">Predictions</span>
        </h1>
        <p className="text-on-background-variant">
          Match predictions open <b>48 hours</b> before kickoff and lock at kickoff.
          Come back daily to predict the next day&apos;s games.
        </p>
      </header>
      {showDemo && <DemoDay />}
      {sortedDays.map((day) => {
        const list = byDay.get(day)!;
        const dateObj = new Date(day + "T00:00:00Z");
        const dayLabel = dateObj.toLocaleDateString(undefined, {
          weekday: "long",
          timeZone: "UTC",
        });
        const dateLabel = dateObj.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });
        const isToday = day === todayUtc;
        return (
          <section
            key={day}
            className={`glass-card rounded-2xl border p-5 sm:p-6 ${
              isToday
                ? "border-secondary/50 shadow-glow"
                : "border-outline-variant/20"
            }`}
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-outline-variant/20 pb-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-2xl font-bold italic uppercase tracking-tighter text-primary sm:text-3xl">
                  {dayLabel}
                </h2>
                <span className="mono text-sm text-on-background-variant">
                  {dateLabel}
                </span>
              </div>
              <span className="mono text-xs uppercase tracking-wider text-on-background-variant">
                {list.length} {list.length === 1 ? "match" : "matches"}
                {isToday ? " · today" : ""}
              </span>
            </div>
            <div className="space-y-3">
              {list.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  marketPicks={marketsByMatch.get(m.id) ?? {}}
                />
              ))}
            </div>
          </section>
        );
      })}
      {rows.length === 0 && (
        <p className="text-on-background-variant">
          No matches in the database. An admin needs to run the seed script.
        </p>
      )}
    </div>
  );
}
