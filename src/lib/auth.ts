import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "./db";

const COOKIE_NAME = "wc_session";
const SESSION_DAYS = 30;

export type User = {
  id: number;
  username: string;
  discriminator: string;
  display_name: string;
  is_admin: boolean;
};

export function formatHandle(u: { username: string; discriminator: string }) {
  return `${u.username}#${u.discriminator}`;
}

export function parseHandle(input: string): { username: string; discriminator: string | null } {
  const trimmed = input.trim().toLowerCase();
  const hash = trimmed.indexOf("#");
  if (hash === -1) return { username: trimmed, discriminator: null };
  return {
    username: trimmed.slice(0, hash),
    discriminator: trimmed.slice(hash + 1),
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await sql<User[]>`
    SELECT u.id, u.username, u.discriminator, u.display_name, u.is_admin
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.is_admin) throw new Error("FORBIDDEN");
  return u;
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expires.toISOString()})
  `;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await sql`DELETE FROM sessions WHERE id = ${token}`;
  jar.delete(COOKIE_NAME);
}

async function pickDiscriminator(username: string): Promise<string> {
  const taken = await sql<{ discriminator: string }[]>`
    SELECT discriminator FROM users WHERE username = ${username}
  `;
  if (taken.length >= 10000)
    throw new Error("Username is full — try a different one.");
  const used = new Set(taken.map((r) => r.discriminator));
  // Random sampling stays uniform until the namespace is nearly exhausted.
  for (let i = 0; i < 20; i++) {
    const n = crypto.randomInt(0, 10000).toString().padStart(4, "0");
    if (!used.has(n)) return n;
  }
  // Fallback: scan deterministically for the smallest free tag.
  for (let n = 0; n < 10000; n++) {
    const s = n.toString().padStart(4, "0");
    if (!used.has(s)) return s;
  }
  throw new Error("Username is full — try a different one.");
}

export async function signup(
  username: string,
  displayName: string,
  password: string
) {
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean))
    throw new Error("Username must be 3-20 chars, letters/numbers/underscore.");
  if (password.length < 6) throw new Error("Password must be at least 6 chars.");
  const dn = displayName.trim() || clean;

  const discriminator = await pickDiscriminator(clean);
  const hash = bcrypt.hashSync(password, 10);

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO users (username, discriminator, display_name, password_hash)
    VALUES (${clean}, ${discriminator}, ${dn}, ${hash})
    RETURNING id
  `;
  await createSession(inserted[0].id);
}

export async function login(input: string, password: string) {
  const { username, discriminator } = parseHandle(input);
  if (!username) throw new Error("Invalid username or password.");

  const rows = discriminator
    ? await sql<{ id: number; password_hash: string }[]>`
        SELECT id, password_hash FROM users
        WHERE username = ${username} AND discriminator = ${discriminator}
        LIMIT 2
      `
    : await sql<{ id: number; password_hash: string }[]>`
        SELECT id, password_hash FROM users
        WHERE username = ${username}
        LIMIT 2
      `;
  if (rows.length > 1)
    throw new Error("Multiple users share that name — use your full handle, e.g. name#1234.");
  const row = rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash))
    throw new Error("Invalid username or password.");
  await createSession(row.id);
}
