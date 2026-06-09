import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, formatHandle } from "@/lib/auth";
import {
  listUserLeagues,
  listPendingInvites,
  createLeague,
  acceptInvite,
  declineInvite,
} from "@/lib/leagues";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [leagues, invites, sp] = await Promise.all([
    listUserLeagues(user.id),
    listPendingInvites(user.id),
    searchParams,
  ]);

  async function createAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    let newId: number;
    try {
      const u = await getCurrentUser();
      if (!u) throw new Error("Not signed in.");
      newId = await createLeague(u.id, name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create league.";
      redirect(`/profile?error=${encodeURIComponent(msg)}`);
    }
    redirect(`/leagues/${newId}`);
  }

  async function acceptAction(formData: FormData) {
    "use server";
    const inviteId = Number(formData.get("invite_id"));
    const u = await getCurrentUser();
    if (!u) redirect("/login");
    await acceptInvite(inviteId, u.id);
    redirect("/profile?ok=joined");
  }

  async function declineAction(formData: FormData) {
    "use server";
    const inviteId = Number(formData.get("invite_id"));
    const u = await getCurrentUser();
    if (!u) redirect("/login");
    await declineInvite(inviteId, u.id);
    redirect("/profile");
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="display-italic mb-1 text-4xl uppercase text-on-background sm:text-5xl">
          {user.display_name}
        </h1>
        <p className="text-on-background-variant">
          Your handle is{" "}
          <span className="mono font-bold text-on-background">
            {formatHandle(user)}
          </span>
          . Share it so friends can invite you to their leagues.
        </p>
        {sp.error && (
          <p className="mt-3 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">
            {sp.error}
          </p>
        )}
        {sp.ok === "joined" && (
          <p className="mt-3 rounded-lg bg-secondary/15 px-3 py-2 text-sm text-secondary">
            Joined league.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
          Pending invites
        </h2>
        {invites.length === 0 ? (
          <p className="glass-card rounded-2xl border border-outline-variant/30 px-5 py-4 text-sm text-on-surface-variant">
            No pending invites.
          </p>
        ) : (
          <ul className="space-y-2">
            {invites.map((i) => (
              <li
                key={i.invite_id}
                className="glass-card flex items-center justify-between gap-4 rounded-2xl border border-outline-variant/30 px-5 py-4"
              >
                <div>
                  <div className="font-bold">{i.league_name}</div>
                  <div className="mono text-[10px] text-on-surface-variant">
                    Invited by {i.inviter_display_name} ·{" "}
                    {i.inviter_username}#{i.inviter_discriminator}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={acceptAction}>
                    <input type="hidden" name="invite_id" value={i.invite_id} />
                    <SubmitButton
                      className="rounded-full bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-secondary hover:brightness-110"
                      pendingLabel="…"
                    >
                      Accept
                    </SubmitButton>
                  </form>
                  <form action={declineAction}>
                    <input type="hidden" name="invite_id" value={i.invite_id} />
                    <SubmitButton
                      className="rounded-full border border-outline-variant/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-error"
                      pendingLabel="…"
                    >
                      Decline
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card rounded-2xl border border-outline-variant/30 p-6">
        <h2 className="mb-3 font-display text-lg font-bold italic uppercase tracking-tighter text-primary">
          Create a league
        </h2>
        <form action={createAction} className="flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            required
            minLength={2}
            maxLength={40}
            placeholder="e.g. Uni squad"
            className="flex-1 rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
          />
          <SubmitButton
            className="rounded-full bg-secondary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110"
            pendingLabel="Creating…"
          >
            Create
          </SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
          Your leagues
        </h2>
        {leagues.length === 0 ? (
          <p className="glass-card rounded-2xl border border-outline-variant/30 px-5 py-4 text-sm text-on-surface-variant">
            You&apos;re not in any league yet. Create one above, or accept an invite.
          </p>
        ) : (
          <ul className="space-y-2">
            {leagues.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leagues/${l.id}`}
                  className="glass-card flex items-center justify-between gap-4 rounded-2xl border border-outline-variant/30 px-5 py-4 hover:border-secondary/50"
                >
                  <div>
                    <div className="font-display text-lg font-bold italic uppercase tracking-tighter text-primary">
                      {l.name}
                    </div>
                    <div className="mono text-[10px] text-on-surface-variant">
                      {l.member_count}{" "}
                      {l.member_count === 1 ? "member" : "members"}
                      {l.owner_id === user.id && " · You own this"}
                    </div>
                  </div>
                  <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
