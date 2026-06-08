import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "./db";

const COOKIE_NAME = "wc_session";
const SESSION_DAYS = 30;

export type User = {
  id: number;
  username: string;
  display_name: string;
  is_admin: boolean;
};

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await sql<User[]>`
    SELECT u.id, u.username, u.display_name, u.is_admin
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

  const existing = await sql`SELECT id FROM users WHERE username = ${clean} LIMIT 1`;
  if (existing.length) throw new Error("Username already taken.");

  const hash = bcrypt.hashSync(password, 10);
  const adminName = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const isAdmin = adminName !== "" && adminName === clean;

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO users (username, display_name, password_hash, is_admin)
    VALUES (${clean}, ${dn}, ${hash}, ${isAdmin})
    RETURNING id
  `;
  await createSession(inserted[0].id);
}

export async function login(username: string, password: string) {
  const clean = username.trim().toLowerCase();
  const rows = await sql<{ id: number; password_hash: string }[]>`
    SELECT id, password_hash FROM users WHERE username = ${clean} LIMIT 1
  `;
  const row = rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash))
    throw new Error("Invalid username or password.");
  await createSession(row.id);
}
