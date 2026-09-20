import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authSecret, isDbConfigured } from "@/lib/env";
import { sql } from "@/lib/sql";

export type SessionUser = {
  id: string;
  email?: string;
};

const COOKIE = "hsw_session";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function hmac(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(hashHex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

function encodeSession(userId: string): string {
  const exp = Date.now() + WEEK_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${hmac(payload)}`;
}

function decodeSession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const payload = `${userId}.${expStr}`;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return userId;
}

async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDbConfigured()) return null;
  const store = await cookies();
  const userId = decodeSession(store.get(COOKIE)?.value);
  if (!userId) return null;
  const rows = await sql()`
    select id, email from users where id = ${userId} limit 1
  `;
  const row = rows[0] as { id: string; email: string } | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email };
}

export async function requireSessionUser(): Promise<SessionUser> {
  if (!isDbConfigured()) redirect("/login");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function ensureSeedUser(): Promise<{
  created: boolean;
  error?: string;
}> {
  const email = process.env.USER_EMAIL?.trim().toLowerCase();
  const password = process.env.USER_PASSWORD;
  if (!email || !password) {
    return { created: false, error: "USER_EMAIL and USER_PASSWORD are not set" };
  }
  if (!isDbConfigured()) {
    return { created: false, error: "Database is not configured" };
  }
  const existing = await sql()`
    select id from users where email = ${email} limit 1
  `;
  if (existing.length > 0) return { created: false };
  await sql()`
    insert into users (email, password_hash)
    values (${email}, ${hashPassword(password)})
  `;
  return { created: true };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const rows = await sql()`
    select id, password_hash from users where email = ${normalized} limit 1
  `;
  const row = rows[0] as { id: string; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return false;
  await setSessionCookie(row.id);
  return true;
}
