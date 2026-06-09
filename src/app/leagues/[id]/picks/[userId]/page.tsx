import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getLeague, isMember } from "@/lib/leagues";
import {
  loadPicksBundle,
  bracketPickPoints,
  groupPositionPoints,
  matchPickPoints,
  type PicksBundle,
} from "@/lib/picks";
import Flag from "@/components/Flag";
import MatchRow from "@/app/matches/MatchRow";
import { getDemoPicks } from "../../../../leaguesDemoPicks";
import MemberBracketView from "./MemberBracketView";

export const dynamic = "force-dynamic";

function Lock({ reason }: { reason: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-outline-variant/40 bg-surface-low/40 px-3 py-2 text-xs text-on-surface-variant">
      <span aria-hidden>🔒</span>
      <span>{reason}</span>
    </div>
  );
}

function Delta({ pts, size = "sm" }: { pts: number; size?: "sm" | "md" }) {
  const color =
    pts > 0
      ? "text-secondary"
      : pts < 0
      ? "text-error"
      : "text-on-surface-variant";
  const cls = size === "md" ? "text-lg" : "text-xs";
  return (
    <span className={`mono font-bold ${color} ${cls}`}>
      {pts >= 0 ? `+${pts}` : pts}
    </span>
  );
}

function SectionTotal({ pts, label }: { pts: number; label: string }) {
  const accent =
    pts > 0
      ? "border-secondary/40 bg-secondary/15"
      : pts < 0
      ? "border-error/40 bg-error/15"
      : "border-outline-variant/40 bg-surface-low/60";
  return (
    <div
      className={`inline-flex items-baseline gap-2 rounded-full border px-3 py-1.5 ${accent}`}
    >
      <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <Delta pts={pts} />
    </div>
  );
}

export default async function MemberPicksPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id, userId } = await params;
  const leagueId = Number(id);
  const memberId = Number(userId);
  if (!Number.isInteger(leagueId) || !Number.isInteger(memberId)) notFound();

  const demoOn = (await cookies()).get("leagues_demo")?.value === "1";

  let bundle: PicksBundle;
  let isSelf: boolean;
  let leagueName: string;

  if (demoOn) {
    const ctx = getDemoPicks(leagueId, memberId);
    if (!ctx) notFound();
    bundle = ctx.bundle;
    isSelf = ctx.isSelf;
    leagueName = ctx.leagueName;
  } else {
    const viewer = await getCurrentUser();
    if (!viewer) redirect("/login");
    const league = await getLeague(leagueId);
    if (!league) notFound();
    if (!(await isMember(leagueId, viewer.id))) redirect("/");
    if (!(await isMember(leagueId, memberId))) notFound();
    bundle = await loadPicksBundle(viewer.id, memberId);
    isSelf = viewer.id === memberId;
    leagueName = league.name;
  }

  return (
    <PicksView
      leagueId={leagueId}
      leagueName={leagueName}
      bundle={bundle}
      isSelf={isSelf}
    />
  );
}

function PicksView({
  leagueId,
  leagueName,
  bundle,
  isSelf,
}: {
  leagueId: number;
  leagueName: string;
  bundle: PicksBundle;
  isSelf: boolean;
}) {
  const teamName = (id: number) => bundle.teams.get(id)?.name ?? `#${id}`;
  const teamFlag = (id: number) => bundle.teams.get(id)?.flag ?? "";

  const viewerCommittedBracket = bundle.viewer.bracketCommittedAt != null;
  const memberCommittedBracket = bundle.member.bracketCommittedAt != null;

  const groupsByLetter = new Map<string, Map<number, number>>();
  for (const g of bundle.member.groups) {
    let m = groupsByLetter.get(g.group_letter);
    if (!m) {
      m = new Map();
      groupsByLetter.set(g.group_letter, m);
    }
    m.set(g.position, g.team_id);
  }
  const allGroupLetters = [
    ...new Set(
      [
        ...bundle.member.groups.map((g) => g.group_letter),
        ...bundle.viewer.groupsCompleted,
      ].filter(Boolean)
    ),
  ].sort();

  const memberMatchById = new Map(
    bundle.member.matches.map((m) => [m.match_id, m])
  );
  const matchById = new Map(bundle.matches.map((m) => [m.id, m]));

  const bracketShown =
    memberCommittedBracket && (isSelf || viewerCommittedBracket);
  const bracketTotal = bracketShown
    ? bundle.member.bracket.reduce(
        (sum, p) => sum + bracketPickPoints(p, bundle.bracketResults),
        0
      )
    : 0;

  const groupTotalsByLetter = new Map<string, number>();
  for (const [letter, positions] of groupsByLetter) {
    const actual = bundle.groupResults.get(letter);
    let total = 0;
    for (const [pos, tid] of positions) {
      total += groupPositionPoints(pos, tid, actual);
    }
    groupTotalsByLetter.set(letter, total);
  }
  // Only count groups the viewer can actually see toward the section total.
  let groupsTotal = 0;
  for (const letter of allGroupLetters) {
    const memberPositions = groupsByLetter.get(letter);
    const viewerHas = bundle.viewer.groupsCompleted.has(letter);
    if (!memberPositions || memberPositions.size === 0) continue;
    if (!isSelf && !viewerHas) continue;
    groupsTotal += groupTotalsByLetter.get(letter) ?? 0;
  }

  // Match section total: only matches the viewer is allowed to see.
  const now = Date.now();
  let matchesTotal = 0;
  for (const p of bundle.member.matches) {
    const m = matchById.get(p.match_id);
    if (!m) continue;
    const closed = new Date(m.kickoff_at).getTime() <= now;
    const viewerHas = bundle.viewer.matchesPredicted.has(m.id);
    if (!(isSelf || closed || viewerHas)) continue;
    const pts = matchPickPoints(p, m);
    if (pts != null) matchesTotal += pts;
  }
  const grandTotal = bracketTotal + groupsTotal + matchesTotal;
  return (
    <div className="space-y-8">
      <header>
        <Link
          href={`/leagues/${leagueId}`}
          className="mono text-[10px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface"
        >
          ← {leagueName}
        </Link>
        <h1 className="display-italic mt-1 text-4xl uppercase text-on-background sm:text-5xl">
          {isSelf ? "Your" : `${bundle.member.display_name}'s`}{" "}
          <span className="text-secondary">picks</span>
        </h1>
        <p className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          {bundle.member.username}#{bundle.member.discriminator}
        </p>
        {!isSelf && (
          <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
            You can only see {bundle.member.display_name}&apos;s pick on a
            particular match, group, or bracket if you&apos;ve made the same
            kind of pick yourself — and only once that thing has locked.
          </p>
        )}
        <div className="mt-4 inline-flex items-baseline gap-3 rounded-full border border-outline-variant/40 bg-surface-low/60 px-4 py-2">
          <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
            Visible total
          </span>
          <Delta pts={grandTotal} size="md" />
          <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
            (Bracket {bracketTotal >= 0 ? `+${bracketTotal}` : bracketTotal} ·
            Groups {groupsTotal >= 0 ? `+${groupsTotal}` : groupsTotal} ·
            Matches {matchesTotal >= 0 ? `+${matchesTotal}` : matchesTotal})
          </span>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
            Bracket
          </h2>
          {bracketShown && <SectionTotal pts={bracketTotal} label="section" />}
        </div>
        {!memberCommittedBracket ? (
          <Lock
            reason={`${bundle.member.display_name} hasn't committed their bracket yet.`}
          />
        ) : !isSelf && !viewerCommittedBracket ? (
          <Lock
            reason={
              <>
                Commit your own bracket first to see this one.{" "}
                <Link
                  href="/board"
                  className="font-bold text-secondary hover:underline"
                >
                  Go to the Board →
                </Link>
              </>
            }
          />
        ) : (
          <MemberBracketView
            teams={[...bundle.teams.values()].map((t) => ({
              id: t.id,
              name: t.name,
              flag: t.flag,
              group_letter: t.group_letter,
            }))}
            groupPicksRows={bundle.member.groups}
            bracketPicksRows={bundle.member.bracket}
          />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
            Group stage
          </h2>
          <SectionTotal pts={groupsTotal} label="section" />
        </div>
        {allGroupLetters.length === 0 ? (
          <Lock reason="No group predictions to compare yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allGroupLetters.map((letter) => {
              const memberPositions = groupsByLetter.get(letter);
              const viewerHas = bundle.viewer.groupsCompleted.has(letter);
              const actual = bundle.groupResults.get(letter);
              const groupTotal = groupTotalsByLetter.get(letter) ?? 0;

              const memberMissing = !memberPositions || memberPositions.size === 0;
              const viewerLocked = !isSelf && !viewerHas;
              const isLocked = memberMissing || viewerLocked;
              const labels = ["1ST", "2ND", "3RD", "4TH"];

              return (
                <details
                  key={letter}
                  open={!isLocked}
                  className={`group rounded-2xl border bg-surface-low transition-colors ${
                    isLocked
                      ? "border-outline-variant/30"
                      : "border-outline-variant/40 hover:border-secondary/40"
                  }`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden">
                    <h3
                      className={`display-italic text-2xl ${
                        isLocked ? "text-on-surface-variant" : "text-secondary"
                      }`}
                    >
                      Group {letter}
                    </h3>
                    <div className="flex items-center gap-3">
                      {isLocked ? (
                        <span aria-hidden className="text-lg">
                          🔒
                        </span>
                      ) : (
                        <Delta pts={groupTotal} size="md" />
                      )}
                      <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant transition-transform group-open:rotate-180">
                        ▾
                      </span>
                    </div>
                  </summary>
                  <div className="border-t border-outline-variant/20 px-4 pb-4 pt-3">
                    {memberMissing ? (
                      <Lock
                        reason={`${bundle.member.display_name} hasn't predicted this group.`}
                      />
                    ) : viewerLocked ? (
                      <Lock
                        reason={`Predict positions 1 & 2 of Group ${letter} first to see this.`}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {[1, 2, 3, 4].map((pos) => {
                          const tid = memberPositions!.get(pos);
                          const isAdvancer = pos <= 2;
                          const pts = tid
                            ? groupPositionPoints(pos, tid, actual)
                            : 0;
                          const filled = tid != null;
                          const filledClasses = isAdvancer
                            ? "bg-secondary/25 text-secondary"
                            : "bg-surface-high text-on-surface";
                          return (
                            <div
                              key={pos}
                              className={`flex h-11 items-center gap-2 rounded-lg border-2 border-dashed px-2 ${
                                filled
                                  ? "border-outline-variant/40 bg-surface-container"
                                  : "border-outline-variant/25"
                              }`}
                            >
                              <span
                                className={`mono shrink-0 text-[10px] uppercase tracking-wider ${
                                  isAdvancer ? "text-secondary" : "text-on-surface-variant"
                                }`}
                              >
                                {labels[pos - 1]}
                              </span>
                              {tid ? (
                                <div
                                  className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-xs font-bold uppercase ${filledClasses}`}
                                >
                                  <Flag code={teamFlag(tid)} size="sm" />
                                  <span className="truncate">{teamName(tid)}</span>
                                </div>
                              ) : (
                                <span className="flex-1 truncate text-[11px] italic text-on-surface-variant">
                                  not picked
                                </span>
                              )}
                              {isAdvancer && tid != null && <Delta pts={pts} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <MatchPicksByDay
        bundle={bundle}
        isSelf={isSelf}
        memberMatchById={memberMatchById}
        sectionTotal={matchesTotal}
      />
    </div>
  );
}

function MatchPicksByDay({
  bundle,
  isSelf,
  memberMatchById,
  sectionTotal,
}: {
  bundle: PicksBundle;
  isSelf: boolean;
  memberMatchById: Map<number, { match_id: number; score_a: number; score_b: number }>;
  sectionTotal: number;
}) {
  const now = Date.now();
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  // Group matches by UTC kickoff date so each "matchday" can collapse on its
  // own — once a day's first match has kicked off, the bets are revealed
  // (matching the existing lock-at-kickoff rule).
  const byDay = new Map<string, typeof bundle.matches>();
  for (const m of bundle.matches) {
    const date = new Date(m.kickoff_at).toISOString().slice(0, 10);
    const arr = byDay.get(date) ?? [];
    arr.push(m);
    byDay.set(date, arr);
  }
  const dayList = [...byDay.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1
  );

  if (dayList.length === 0) {
    return (
      <section>
        <h2 className="mb-3 font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
          Match picks
        </h2>
        <Lock reason="No matches in the schedule yet." />
      </section>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
          Match picks
        </h2>
        <SectionTotal pts={sectionTotal} label="section" />
      </div>
      <div className="space-y-3">
        {dayList.map(([date, matches]) => {
          const firstKickoff = Math.min(
            ...matches.map((m) => new Date(m.kickoff_at).getTime())
          );
          const dayClosed = firstKickoff <= now;
          const memberPredictedCount = matches.filter((m) =>
            memberMatchById.has(m.id)
          ).length;
          const isPast = date < todayIso;
          const isToday = date === todayIso;
          const friendlyDate = dayFmt.format(new Date(`${date}T00:00:00Z`));

          let dayTotal = 0;
          for (const m of matches) {
            const memberPick = memberMatchById.get(m.id);
            if (!memberPick) continue;
            const closed = new Date(m.kickoff_at).getTime() <= now;
            const viewerHas = bundle.viewer.matchesPredicted.has(m.id);
            if (!(isSelf || closed || viewerHas)) continue;
            const pts = matchPickPoints(memberPick, m);
            if (pts != null) dayTotal += pts;
          }

          return (
            <details
              key={date}
              open={isToday || isPast}
              className="glass-card group rounded-2xl border border-outline-variant/30 transition-colors hover:border-secondary/50"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="font-display text-lg font-bold italic uppercase tracking-tighter text-on-background">
                    {friendlyDate}
                  </div>
                  <div className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {matches.length}{" "}
                    {matches.length === 1 ? "match" : "matches"}
                    {" · "}
                    {memberPredictedCount}/{matches.length} picked
                    {" · "}
                    {dayClosed ? (
                      <span className="text-secondary">locked</span>
                    ) : (
                      <span>upcoming</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Delta pts={dayTotal} size="md" />
                  <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </div>
              </summary>
              <div className="space-y-3 border-t border-outline-variant/30 px-5 py-4">
                {matches.map((m) => {
                  const memberPick = memberMatchById.get(m.id);
                  const memberMarkets =
                    bundle.member.markets.get(m.id) ?? {};
                  const viewerHas = bundle.viewer.matchesPredicted.has(m.id);
                  const closed = new Date(m.kickoff_at).getTime() <= now;
                  const hasAnyMemberPick =
                    memberPick != null ||
                    Object.keys(memberMarkets).length > 0;
                  // Visible if: member made any pick AND (match locked OR viewer also predicted).
                  // Self always sees their own picks.
                  const canSee =
                    hasAnyMemberPick && (isSelf || closed || viewerHas);

                  if (canSee) {
                    const matchForRow = {
                      id: m.id,
                      stage: m.stage,
                      group_letter: m.group_letter,
                      team_a_name: m.team_a_name,
                      team_a_flag: m.team_a_flag,
                      team_a_label: m.team_a_label,
                      team_b_name: m.team_b_name,
                      team_b_flag: m.team_b_flag,
                      team_b_label: m.team_b_label,
                      kickoff_at:
                        m.kickoff_at instanceof Date
                          ? m.kickoff_at.toISOString()
                          : String(m.kickoff_at),
                      actual_score_a: m.actual_score_a,
                      actual_score_b: m.actual_score_b,
                      status: m.status,
                      pred_a: memberPick?.score_a ?? null,
                      pred_b: memberPick?.score_b ?? null,
                    };
                    return (
                      <MatchRow
                        key={m.id}
                        match={matchForRow}
                        marketPicks={memberMarkets}
                        pickLabel={
                          isSelf
                            ? "Your pick"
                            : `${bundle.member.display_name}'s pick`
                        }
                      />
                    );
                  }

                  const reason = !hasAnyMemberPick
                    ? `${bundle.member.display_name} didn't bet on this match.`
                    : closed
                    ? `${bundle.member.display_name}'s pick is hidden — you didn't bet on this match.`
                    : `Bet on this match first to see ${bundle.member.display_name}'s pick.`;
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-outline-variant/30 bg-surface-low/40 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-on-surface-variant">
                        <span className="mono">
                          {m.group_letter
                            ? `Group ${m.group_letter}`
                            : m.stage.toUpperCase()}
                          {" · "}
                          {new Date(m.kickoff_at).toLocaleTimeString(
                            undefined,
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                        <span className="mono inline-flex items-center gap-1 rounded-full bg-surface-high px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                          🔒
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                        <div className="flex items-center justify-end gap-2 truncate text-right">
                          <span className="truncate text-sm font-bold uppercase">
                            {m.team_a_name ?? m.team_a_label}
                          </span>
                          {m.team_a_flag ? (
                            <Flag code={m.team_a_flag} size="md" />
                          ) : null}
                        </div>
                        <span className="mono text-secondary">vs</span>
                        <div className="flex items-center gap-2 truncate">
                          {m.team_b_flag ? (
                            <Flag code={m.team_b_flag} size="md" />
                          ) : null}
                          <span className="truncate text-sm font-bold uppercase">
                            {m.team_b_name ?? m.team_b_label}
                          </span>
                        </div>
                      </div>
                      <p className="mono mt-3 text-[11px] uppercase tracking-wider text-on-surface-variant">
                        {reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
