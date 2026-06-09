import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, formatHandle } from "@/lib/auth";
import {
  getLeague,
  isMember,
  listMembers,
  inviteByHandle,
  leaveLeague,
  removeMember,
} from "@/lib/leagues";
import { computeLeaderboard } from "@/lib/scoring";
import { autoSyncForPage } from "@/lib/autoSync";
import SubmitButton from "@/components/SubmitButton";
import ClickableRow from "@/components/ClickableRow";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const leagueId = Number(id);
  if (!Number.isInteger(leagueId)) notFound();

  const league = await getLeague(leagueId);
  if (!league) notFound();
  if (!(await isMember(leagueId, user.id))) redirect("/");

  await autoSyncForPage();

  const [members, sp] = await Promise.all([listMembers(leagueId), searchParams]);
  const board = await computeLeaderboard(members.map((m) => m.user_id));
  const isOwner = league.owner_id === user.id;

  async function inviteAction(formData: FormData) {
    "use server";
    const handle = String(formData.get("handle") ?? "");
    try {
      const u = await getCurrentUser();
      if (!u) throw new Error("Not signed in.");
      await inviteByHandle(leagueId, u.id, handle);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send invite.";
      redirect(`/leagues/${leagueId}?error=${encodeURIComponent(msg)}`);
    }
    redirect(`/leagues/${leagueId}?ok=invited`);
  }

  async function leaveAction() {
    "use server";
    const u = await getCurrentUser();
    if (!u) redirect("/login");
    await leaveLeague(leagueId, u.id);
    redirect("/");
  }

  async function removeAction(formData: FormData) {
    "use server";
    const memberId = Number(formData.get("member_id"));
    try {
      const u = await getCurrentUser();
      if (!u) throw new Error("Not signed in.");
      await removeMember(leagueId, u.id, memberId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove member.";
      redirect(`/leagues/${leagueId}?error=${encodeURIComponent(msg)}`);
    }
    redirect(`/leagues/${leagueId}`);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mono text-[10px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface"
          >
            ← All leagues
          </Link>
          <h1 className="display-italic mt-1 text-4xl uppercase text-on-background sm:text-5xl">
            {league.name}
          </h1>
          <p className="text-on-background-variant">
            {league.member_count} {league.member_count === 1 ? "member" : "members"}
            {isOwner && " · You own this league"}
          </p>
        </div>
        <form action={leaveAction}>
          <SubmitButton
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:bg-error/15 hover:text-error"
            pendingLabel={isOwner ? "Deleting…" : "Leaving…"}
          >
            {isOwner ? "Delete league" : "Leave"}
          </SubmitButton>
        </form>
      </header>

      {sp.error && (
        <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{sp.error}</p>
      )}
      {sp.ok === "invited" && (
        <p className="rounded-lg bg-secondary/15 px-3 py-2 text-sm text-secondary">
          Invite sent.
        </p>
      )}

      <section>
        <h2 className="mb-4 font-display text-2xl font-bold italic uppercase tracking-tighter text-primary">
          Leaderboard
        </h2>
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
              {board.map((r, i) => (
                <ClickableRow
                  key={r.user_id}
                  href={`/leagues/${leagueId}/picks/${r.user_id}`}
                  ariaLabel={`View ${r.display_name}'s picks`}
                  className={`group border-t border-outline-variant/20 transition-colors hover:bg-secondary/10 ${
                    user.id === r.user_id ? "bg-secondary/10" : ""
                  }`}
                >
                  <td className="mono px-5 py-3 text-on-surface-variant">{i + 1}</td>
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
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl border border-outline-variant/30 p-6">
          <h3 className="mb-4 font-display text-lg font-bold italic uppercase tracking-tighter text-primary">
            Members
          </h3>
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded-lg bg-surface-low/60 px-3 py-2"
              >
                <div>
                  <div className="font-bold">{m.display_name}</div>
                  <div className="mono text-[10px] text-on-surface-variant">
                    {formatHandle(m)} {m.is_owner && "· owner"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/leagues/${leagueId}/picks/${m.user_id}`}
                    className="mono text-[10px] uppercase tracking-wider text-secondary hover:underline"
                  >
                    {user.id === m.user_id ? "My picks" : "View picks"}
                  </Link>
                  {isOwner && !m.is_owner && (
                    <form action={removeAction}>
                      <input type="hidden" name="member_id" value={m.user_id} />
                      <SubmitButton
                        className="mono text-[10px] uppercase tracking-wider text-on-surface-variant hover:text-error"
                        pendingLabel="…"
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {isOwner && (
          <div className="glass-card rounded-2xl border border-outline-variant/30 p-6">
            <h3 className="mb-2 font-display text-lg font-bold italic uppercase tracking-tighter text-primary">
              Invite by handle
            </h3>
            <p className="mb-4 text-xs text-on-surface-variant">
              Enter their full handle, including the four-digit tag (e.g. arda#7421).
              Your handle is{" "}
              <span className="mono text-on-surface">{formatHandle(user)}</span>.
            </p>
            <form action={inviteAction} className="space-y-3">
              <input
                name="handle"
                required
                placeholder="name#1234"
                className="block w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              />
              <SubmitButton
                className="w-full rounded-full bg-secondary py-2.5 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110"
                pendingLabel="Sending…"
              >
                Send invite
              </SubmitButton>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
