import { computeLeaderboard } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth";
import { autoSyncForPage } from "@/lib/autoSync";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  await autoSyncForPage();

  const [board, user] = await Promise.all([
    computeLeaderboard().catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="display-italic mb-3 text-5xl uppercase text-on-background sm:text-6xl">
          Road to <span className="text-secondary">Glory</span>
        </h1>
        <p className="mx-auto max-w-2xl text-on-background-variant">
          Predict every match from group stage to the final and crown the world
          champion. Most points wins eternal bragging rights.
        </p>
        {!user && (
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-secondary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-outline-light px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-on-background hover:bg-on-background hover:text-background"
            >
              I already have one
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold italic uppercase tracking-tighter text-primary">
            Leaderboard
          </h2>
          <span className="mono text-xs uppercase text-on-surface-variant">
            {board.length} {board.length === 1 ? "player" : "players"}
          </span>
        </div>
        {board.length === 0 ? (
          <div className="glass-card rounded-2xl border border-outline-variant/30 p-8 text-center text-on-surface-variant">
            No scores yet. Get your friends to sign up and start predicting.
          </div>
        ) : (
          <div className="glass-card overflow-hidden rounded-2xl border border-outline-variant/30">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3 text-right">Matches</th>
                  <th className="px-5 py-3 text-right">Groups</th>
                  <th className="px-5 py-3 text-right">Bracket</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r, i) => (
                  <tr
                    key={r.user_id}
                    className={`border-t border-outline-variant/20 ${
                      user?.id === r.user_id ? "bg-secondary/10" : ""
                    }`}
                  >
                    <td className="mono px-5 py-3 text-on-surface-variant">{i + 1}</td>
                    <td className="px-5 py-3 font-bold">{r.display_name}</td>
                    <td className="mono px-5 py-3 text-right">{r.match_points}</td>
                    <td className="mono px-5 py-3 text-right">{r.group_points}</td>
                    <td className="mono px-5 py-3 text-right">{r.bracket_points}</td>
                    <td className="mono px-5 py-3 text-right text-base font-bold text-secondary">
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl border border-outline-variant/30 p-6">
        <h3 className="mb-4 font-display text-lg font-bold italic uppercase tracking-tighter text-primary">
          Scoring
        </h3>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Exact match score", 5],
            ["Correct winner + goal diff", 3],
            ["Correct winner only", 2],
            ["Group: team in exact position", 4],
            ["Group: team in top 2, wrong order", 2],
            ["Each correct quarterfinalist", 2],
            ["Each correct semifinalist", 4],
            ["Each correct finalist", 8],
            ["Champion", 16],
          ].map(([label, pts]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-surface-low/60 px-3 py-2"
            >
              <span className="text-on-surface-variant">{label}</span>
              <span className="mono font-bold text-secondary">{pts} pts</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
