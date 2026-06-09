import Link from "next/link";
import { cookies } from "next/headers";
import { computeLeaderboard, computeHighlights, computeDailyTopBottom } from "@/lib/scoring";
import type { Highlight } from "@/lib/scoring";
import { getCurrentUser, formatHandle } from "@/lib/auth";
import { autoSyncForPage } from "@/lib/autoSync";
import { listUserLeagues, listMembers } from "@/lib/leagues";
import { LEAGUES_DEMO } from "./leaguesDemoData";
import PlayerBetsPair from "./PlayerBetsPair";
import ClickableRow from "@/components/ClickableRow";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Demo cookie short-circuits before any DB or auto-sync — that way the
  // hardcoded preview still works even when the migration isn't applied yet.
  const demoOn = (await cookies()).get("leagues_demo")?.value === "1";
  if (demoOn) return <DemoLeagues />;

  await autoSyncForPage();
  const user = await getCurrentUser().catch(() => null);

  if (!user) return <LoggedOutLanding />;

  const leagues = await listUserLeagues(user.id);

  const boards = await Promise.all(
    leagues.map(async (l) => {
      const members = await listMembers(l.id);
      const ids = members.map((m) => m.user_id);
      const [rows, highlights, daily] = await Promise.all([
        computeLeaderboard(ids),
        computeHighlights(ids),
        computeDailyTopBottom(ids),
      ]);
      return { league: l, rows, highlights, daily };
    })
  );

  return (
    <div className="space-y-10">
      <section>
        <h1 className="display-italic mb-1 text-4xl uppercase text-on-background sm:text-5xl">
          Your <span className="text-secondary">Leagues</span>
        </h1>
        <p className="text-on-background-variant">
          Predictions are ranked within friend groups. Your handle is{" "}
          <span className="mono font-bold text-on-background">
            {formatHandle(user)}
          </span>
          . Create a league or accept invites from your{" "}
          <Link href="/profile" className="text-secondary hover:underline">
            profile
          </Link>
          .
        </p>
      </section>

      {boards.length === 0 ? (
        <section className="glass-card rounded-2xl border border-outline-variant/30 p-8 text-center text-on-surface-variant">
          You&apos;re not in any league yet.{" "}
          <Link href="/profile" className="text-secondary hover:underline">
            Head to your profile
          </Link>{" "}
          to create one or accept an invite.
        </section>
      ) : (
        boards.map(({ league, rows, highlights, daily }) => (
          <section key={league.id}>
            <div className="mb-3 flex items-center justify-between">
              <Link
                href={`/leagues/${league.id}`}
                className="font-display text-2xl font-bold italic uppercase tracking-tighter text-primary hover:text-secondary"
              >
                {league.name}
              </Link>
              <span className="mono text-xs uppercase text-on-surface-variant">
                {league.member_count}{" "}
                {league.member_count === 1 ? "player" : "players"}
              </span>
            </div>
            <PlayerBetsPair
              date={daily?.date ?? null}
              winner={daily?.winner ?? null}
              winnerBets={daily?.winnerBets ?? []}
              loser={daily?.loser ?? null}
              loserBets={daily?.loserBets ?? []}
            />
            <div className="glass-card overflow-hidden rounded-2xl border border-outline-variant/30">
              <div className="border-b border-outline-variant/30 px-5 py-2">
                <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Tap any row to see that player&apos;s picks →
                </span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3 text-right">Matches</th>
                    <th className="px-5 py-3 text-right">Groups</th>
                    <th className="px-5 py-3 text-right">Bracket</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <ClickableRow
                      key={r.user_id}
                      href={`/leagues/${league.id}/picks/${r.user_id}`}
                      ariaLabel={`View ${r.display_name}'s picks`}
                      className={`group border-t border-outline-variant/20 transition-colors hover:bg-secondary/10 ${
                        user.id === r.user_id ? "bg-secondary/10" : ""
                      }`}
                    >
                      <td className="mono px-5 py-3 text-on-surface-variant">
                        {i + 1}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-bold transition-colors group-hover:text-secondary">
                          {r.display_name}
                        </div>
                        <div className="mono text-[10px] text-on-surface-variant">
                          {formatHandle(r)}
                        </div>
                      </td>
                      <td className="mono px-5 py-3 text-right">{r.match_points}</td>
                      <td className="mono px-5 py-3 text-right">{r.group_points}</td>
                      <td className="mono px-5 py-3 text-right">{r.bracket_points}</td>
                      <td className="mono px-5 py-3 text-right text-base font-bold text-secondary">
                        {r.total}
                      </td>
                      <td className="px-3 py-3 text-right text-lg text-on-surface-variant transition-colors group-hover:text-secondary">
                        ›
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
            <HighlightsBlock highlights={highlights} />
          </section>
        ))
      )}
    </div>
  );
}

function HighlightLine({
  kind,
  pick,
}: {
  kind: "top" | "bottom";
  pick: Highlight;
}) {
  const color = kind === "top" ? "text-secondary" : "text-error";
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="truncate">
        <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          {kind === "top" ? "Most" : "Least"}
        </span>{" "}
        <span className="font-bold">{pick.display_name}</span>
      </span>
      <span className={`mono shrink-0 font-bold ${color}`}>
        {pick.pts > 0 ? `+${pick.pts}` : pick.pts}
      </span>
    </div>
  );
}

function HighlightsBlock({
  highlights,
}: {
  highlights: { byDay: Array<{ date: string; top: Highlight; bottom: Highlight }>;
                byMatch: Array<{ match_id: number; label: string; top: Highlight; bottom: Highlight }> };
}) {
  if (highlights.byDay.length === 0 && highlights.byMatch.length === 0) return null;
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="glass-card rounded-2xl border border-outline-variant/30 p-5">
        <h3 className="mb-3 font-display text-sm font-bold italic uppercase tracking-tighter text-primary">
          By match day
        </h3>
        {highlights.byDay.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No predictions yet.</p>
        ) : (
          <ul className="space-y-3">
            {highlights.byDay.map((d) => (
              <li key={d.date} className="rounded-lg bg-surface-low/60 px-3 py-2">
                <div className="mono mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
                  {d.date}
                </div>
                <HighlightLine kind="top" pick={d.top} />
                <HighlightLine kind="bottom" pick={d.bottom} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/30 p-5">
        <h3 className="mb-3 font-display text-sm font-bold italic uppercase tracking-tighter text-primary">
          By match
        </h3>
        {highlights.byMatch.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No predictions yet.</p>
        ) : (
          <ul className="space-y-3">
            {highlights.byMatch.map((m) => (
              <li key={m.match_id} className="rounded-lg bg-surface-low/60 px-3 py-2">
                <div className="mono mb-1 truncate text-[10px] uppercase tracking-wider text-on-surface-variant">
                  {m.label}
                </div>
                <HighlightLine kind="top" pick={m.top} />
                <HighlightLine kind="bottom" pick={m.bottom} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DemoLeagues() {
  const { viewer, leagues } = LEAGUES_DEMO;
  const viewerHandle = `${viewer.username}#${viewer.discriminator}`;
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-2 inline-block rounded-full bg-secondary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
          Preview · hardcoded
        </div>
        <h1 className="display-italic mb-1 text-4xl uppercase text-on-background sm:text-5xl">
          Your <span className="text-secondary">Leagues</span>
        </h1>
        <p className="text-on-background-variant">
          Demo data — turn off in admin → Preview. Viewing as{" "}
          <span className="mono font-bold text-on-background">
            {viewerHandle}
          </span>
          .
        </p>
      </section>

      {leagues.map((league) => {
        return (
        <section key={league.id}>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-2xl font-bold italic uppercase tracking-tighter text-primary">
              {league.name}
            </span>
            <span className="mono text-xs uppercase text-on-surface-variant">
              {league.member_count}{" "}
              {league.member_count === 1 ? "player" : "players"}
            </span>
          </div>
          <PlayerBetsPair
            date={league.daily.date}
            winner={league.daily.winner}
            winnerBets={league.daily.winnerBets}
            loser={league.daily.loser}
            loserBets={league.daily.loserBets}
          />
          <div className="glass-card overflow-hidden rounded-2xl border border-outline-variant/30">
            <div className="border-b border-outline-variant/30 px-5 py-2">
              <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                Tap any row to see that player&apos;s picks →
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3 text-right">Matches</th>
                  <th className="px-5 py-3 text-right">Groups</th>
                  <th className="px-5 py-3 text-right">Bracket</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {league.rows.map((r, i) => (
                  <ClickableRow
                    key={r.user_id}
                    href={`/leagues/${league.id}/picks/${r.user_id}`}
                    ariaLabel={`View ${r.display_name}'s picks`}
                    className={`group border-t border-outline-variant/20 transition-colors hover:bg-secondary/10 ${
                      viewer.user_id === r.user_id ? "bg-secondary/10" : ""
                    }`}
                  >
                    <td className="mono px-5 py-3 text-on-surface-variant">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="font-bold transition-colors group-hover:text-secondary">
                        {r.display_name}
                      </div>
                      <div className="mono text-[10px] text-on-surface-variant">
                        {r.username}#{r.discriminator}
                      </div>
                    </td>
                    <td className="mono px-5 py-3 text-right">{r.match_points}</td>
                    <td className="mono px-5 py-3 text-right">{r.group_points}</td>
                    <td className="mono px-5 py-3 text-right">{r.bracket_points}</td>
                    <td className="mono px-5 py-3 text-right text-base font-bold text-secondary">
                      {r.total}
                    </td>
                    <td className="px-3 py-3 text-right text-lg text-on-surface-variant transition-colors group-hover:text-secondary">
                      ›
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
          <HighlightsBlock highlights={league.highlights} />
        </section>
        );
      })}
    </div>
  );
}

function LoggedOutLanding() {
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="display-italic mb-3 text-5xl uppercase text-on-background sm:text-6xl">
          Road to <span className="text-secondary">Glory</span>
        </h1>
        <p className="mx-auto max-w-2xl text-on-background-variant">
          Predict every match of the 2026 FIFA World Cup — from group stage to
          the final — and crown the world champion. Create a private league
          with your friends; most points wins eternal bragging rights.
        </p>
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
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl border border-outline-variant/30 p-5 text-left">
          <h2 className="font-display text-sm font-bold italic uppercase tracking-tighter text-primary">
            Match-by-match predictions
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Call exact scores for every group-stage and knockout fixture.
            Predictions lock at kickoff.
          </p>
        </div>
        <div className="glass-card rounded-2xl border border-outline-variant/30 p-5 text-left">
          <h2 className="font-display text-sm font-bold italic uppercase tracking-tighter text-primary">
            Group tables &amp; full bracket
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Pick group qualifiers, fill out the knockout bracket, and crown
            your World Cup champion.
          </p>
        </div>
        <div className="glass-card rounded-2xl border border-outline-variant/30 p-5 text-left">
          <h2 className="font-display text-sm font-bold italic uppercase tracking-tighter text-primary">
            Private friends-only leagues
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Invite by handle, keep results to your group, and watch the live
            leaderboard update as results come in.
          </p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                url: `${SITE_URL}/`,
                name: SITE_NAME,
                description: SITE_DESCRIPTION,
                inLanguage: "en",
              },
              {
                "@type": "WebApplication",
                "@id": `${SITE_URL}/#app`,
                name: SITE_NAME,
                url: `${SITE_URL}/`,
                applicationCategory: "SportsApplication",
                operatingSystem: "Any",
                description: SITE_DESCRIPTION,
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
              },
              {
                "@type": "SportsEvent",
                name: "2026 FIFA World Cup",
                startDate: "2026-06-11",
                endDate: "2026-07-19",
                sport: "Association football",
                eventStatus: "https://schema.org/EventScheduled",
                eventAttendanceMode:
                  "https://schema.org/OfflineEventAttendanceMode",
                location: [
                  { "@type": "Country", name: "United States" },
                  { "@type": "Country", name: "Canada" },
                  { "@type": "Country", name: "Mexico" },
                ],
              },
            ],
          }),
        }}
      />
    </div>
  );
}
