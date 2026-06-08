import Link from "next/link";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PredictHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [matchTotalRow, matchDoneRow, groupDoneRow, bracketDoneRow] =
    await Promise.all([
      sql<{ c: string }[]>`SELECT COUNT(*)::text c FROM matches`,
      sql<{ c: string }[]>`SELECT COUNT(*)::text c FROM match_predictions WHERE user_id = ${user.id}`,
      sql<{ c: string }[]>`SELECT COUNT(DISTINCT group_letter)::text c FROM group_predictions WHERE user_id = ${user.id}`,
      sql<{ c: string }[]>`SELECT COUNT(*)::text c FROM bracket_predictions WHERE user_id = ${user.id}`,
    ]);

  const matchTotal = Number(matchTotalRow[0].c);
  const matchDone = Number(matchDoneRow[0].c);
  const groupDone = Number(groupDoneRow[0].c);
  const bracketDone = Number(bracketDoneRow[0].c);
  const boardDone = groupDone + bracketDone;
  const boardTotal = 12 + 15;

  const cards = [
    {
      href: "/matches",
      title: "Match Scores",
      blurb: "Predict the exact score for upcoming games. Opens 24h before kickoff.",
      done: matchDone,
      total: matchTotal,
      unit: "predictions",
      color: "from-secondary/30 to-secondary/5",
      accent: "text-secondary",
    },
    {
      href: "/board",
      title: "The Board",
      blurb: "Group standings + knockout bracket on one interactive canvas.",
      done: boardDone,
      total: boardTotal,
      unit: "picks",
      color: "from-primary/30 to-primary/5",
      accent: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display-italic mb-2 text-4xl uppercase text-on-background sm:text-5xl">
          Make your <span className="text-secondary">picks</span>
        </h1>
        <p className="text-on-background-variant">
          Two things to predict. Match scores roll out daily; the board is a
          one-time fill-in.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
          const complete = c.done >= c.total && c.total > 0;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="glass-card group relative overflow-hidden rounded-2xl border border-outline-variant/30 p-6 transition hover:-translate-y-1 hover:border-secondary/60"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${c.color} opacity-60 transition group-hover:opacity-100`}
              />
              <div className="relative">
                <div className="mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {complete ? "Locked in" : `${c.done}/${c.total} ${c.unit}`}
                </div>
                <h2 className={`display-italic mt-2 text-3xl uppercase ${c.accent}`}>
                  {c.title}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">{c.blurb}</p>

                <div className="mt-6">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-secondary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mono mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-on-surface-variant">
                    <span>{pct}%</span>
                    <span className="transition group-hover:text-secondary">
                      Open →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
