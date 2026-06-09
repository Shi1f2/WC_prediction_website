import { sql } from "./db";
import { parseHandle } from "./auth";

export type League = {
  id: number;
  name: string;
  owner_id: number;
  member_count: number;
};

export type LeagueMember = {
  user_id: number;
  username: string;
  discriminator: string;
  display_name: string;
  joined_at: Date;
  is_owner: boolean;
};

export type PendingInvite = {
  invite_id: number;
  league_id: number;
  league_name: string;
  inviter_username: string;
  inviter_discriminator: string;
  inviter_display_name: string;
};

export async function listUserLeagues(userId: number): Promise<League[]> {
  return await sql<League[]>`
    SELECT l.id, l.name, l.owner_id,
           (SELECT COUNT(*)::int FROM league_members lm2 WHERE lm2.league_id = l.id) AS member_count
    FROM leagues l
    JOIN league_members lm ON lm.league_id = l.id
    WHERE lm.user_id = ${userId}
    ORDER BY l.created_at ASC
  `;
}

export async function getLeague(leagueId: number): Promise<League | null> {
  const rows = await sql<League[]>`
    SELECT l.id, l.name, l.owner_id,
           (SELECT COUNT(*)::int FROM league_members lm2 WHERE lm2.league_id = l.id) AS member_count
    FROM leagues l WHERE l.id = ${leagueId}
  `;
  return rows[0] ?? null;
}

export async function isMember(leagueId: number, userId: number): Promise<boolean> {
  const rows = await sql<{ league_id: number }[]>`
    SELECT league_id FROM league_members
    WHERE league_id = ${leagueId} AND user_id = ${userId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function listMembers(leagueId: number): Promise<LeagueMember[]> {
  const rows = await sql<
    {
      user_id: number;
      username: string;
      discriminator: string;
      display_name: string;
      joined_at: Date;
      owner_id: number;
    }[]
  >`
    SELECT u.id AS user_id, u.username, u.discriminator, u.display_name,
           lm.joined_at, l.owner_id
    FROM league_members lm
    JOIN users u   ON u.id = lm.user_id
    JOIN leagues l ON l.id = lm.league_id
    WHERE lm.league_id = ${leagueId}
    ORDER BY lm.joined_at ASC
  `;
  return rows.map((r) => ({
    user_id: r.user_id,
    username: r.username,
    discriminator: r.discriminator,
    display_name: r.display_name,
    joined_at: r.joined_at,
    is_owner: r.owner_id === r.user_id,
  }));
}

export async function listPendingInvites(userId: number): Promise<PendingInvite[]> {
  return await sql<PendingInvite[]>`
    SELECT i.id AS invite_id, l.id AS league_id, l.name AS league_name,
           u.username AS inviter_username, u.discriminator AS inviter_discriminator,
           u.display_name AS inviter_display_name
    FROM league_invites i
    JOIN leagues l ON l.id = i.league_id
    JOIN users u   ON u.id = i.inviter_id
    WHERE i.invitee_id = ${userId}
    ORDER BY i.created_at DESC
  `;
}

export async function createLeague(ownerId: number, name: string): Promise<number> {
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 40)
    throw new Error("League name must be 2-40 characters.");
  const id = await sql.begin(async (tx) => {
    const inserted = await tx<{ id: number }[]>`
      INSERT INTO leagues (name, owner_id) VALUES (${clean}, ${ownerId})
      RETURNING id
    `;
    const leagueId = inserted[0].id;
    await tx`
      INSERT INTO league_members (league_id, user_id) VALUES (${leagueId}, ${ownerId})
    `;
    return leagueId;
  });
  return id;
}

export async function inviteByHandle(
  leagueId: number,
  inviterId: number,
  handle: string
): Promise<void> {
  const { username, discriminator } = parseHandle(handle);
  if (!username || !discriminator)
    throw new Error("Use a full handle, e.g. name#1234.");

  const owner = await sql<{ owner_id: number }[]>`
    SELECT owner_id FROM leagues WHERE id = ${leagueId}
  `;
  if (!owner.length) throw new Error("League not found.");
  if (owner[0].owner_id !== inviterId)
    throw new Error("Only the league owner can invite people.");

  const found = await sql<{ id: number }[]>`
    SELECT id FROM users
    WHERE username = ${username} AND discriminator = ${discriminator}
    LIMIT 1
  `;
  if (!found.length) throw new Error(`No user with handle ${username}#${discriminator}.`);
  const inviteeId = found[0].id;

  if (inviteeId === inviterId)
    throw new Error("You're already in the league.");

  const already = await sql<{ league_id: number }[]>`
    SELECT league_id FROM league_members
    WHERE league_id = ${leagueId} AND user_id = ${inviteeId} LIMIT 1
  `;
  if (already.length) throw new Error("That user is already a member.");

  await sql`
    INSERT INTO league_invites (league_id, inviter_id, invitee_id)
    VALUES (${leagueId}, ${inviterId}, ${inviteeId})
    ON CONFLICT (league_id, invitee_id) DO NOTHING
  `;
}

export async function acceptInvite(inviteId: number, userId: number): Promise<void> {
  await sql.begin(async (tx) => {
    const rows = await tx<{ league_id: number }[]>`
      SELECT league_id FROM league_invites
      WHERE id = ${inviteId} AND invitee_id = ${userId}
      LIMIT 1
    `;
    if (!rows.length) throw new Error("Invite not found.");
    const leagueId = rows[0].league_id;
    await tx`
      INSERT INTO league_members (league_id, user_id)
      VALUES (${leagueId}, ${userId})
      ON CONFLICT DO NOTHING
    `;
    await tx`DELETE FROM league_invites WHERE id = ${inviteId}`;
  });
}

export async function declineInvite(inviteId: number, userId: number): Promise<void> {
  await sql`
    DELETE FROM league_invites WHERE id = ${inviteId} AND invitee_id = ${userId}
  `;
}

export async function leaveLeague(leagueId: number, userId: number): Promise<void> {
  const owner = await sql<{ owner_id: number }[]>`
    SELECT owner_id FROM leagues WHERE id = ${leagueId}
  `;
  if (!owner.length) return;
  if (owner[0].owner_id === userId) {
    // Owner leaving deletes the league outright so it doesn't get orphaned.
    await sql`DELETE FROM leagues WHERE id = ${leagueId}`;
    return;
  }
  await sql`
    DELETE FROM league_members WHERE league_id = ${leagueId} AND user_id = ${userId}
  `;
}

export async function removeMember(
  leagueId: number,
  ownerId: number,
  memberId: number
): Promise<void> {
  const owner = await sql<{ owner_id: number }[]>`
    SELECT owner_id FROM leagues WHERE id = ${leagueId}
  `;
  if (!owner.length) throw new Error("League not found.");
  if (owner[0].owner_id !== ownerId)
    throw new Error("Only the owner can remove members.");
  if (memberId === ownerId)
    throw new Error("Owner cannot remove themselves; leave the league instead.");
  await sql`
    DELETE FROM league_members WHERE league_id = ${leagueId} AND user_id = ${memberId}
  `;
}
