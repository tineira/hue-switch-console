import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/account-config";
import { auth } from "@/lib/better-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { sql } from "@/lib/sql";

// Human sessions are Better Auth sessions (docs/specs/finished/multi-user-accounts.md §2.2).
// Pages and routes keep calling getSessionUser / requireSessionUser.

export type SessionUser = {
  id: string;
  email?: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDbConfigured()) return null;
  await ensureSchema();
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session || session.user.banned) return null;
  return { id: session.user.id, email: session.user.email };
}

export async function requireSessionUser(): Promise<SessionUser> {
  if (!isDbConfigured()) redirect("/login");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!isAdminEmail(user.email)) redirect("/");
  return user;
}

let seeded = false;

/** Seeds USER_EMAIL with a password sign-in (`credential` account) from USER_PASSWORD. */
export async function ensureSeedUser(): Promise<{ created: boolean; error?: string }> {
  if (seeded) return { created: false };
  const email = process.env.USER_EMAIL?.trim().toLowerCase();
  const password = process.env.USER_PASSWORD;
  if (!email || !password) {
    return { created: false, error: "USER_EMAIL and USER_PASSWORD are not set" };
  }
  if (!isDbConfigured()) {
    return { created: false, error: "Database is not configured" };
  }
  await ensureSchema();
  const db = sql();
  let created = false;
  const existing = await db`select id from users where email = ${email} limit 1`;
  let row = existing[0] as { id: string } | undefined;
  if (!row) {
    const inserted = await db`
      insert into users (email, email_verified) values (${email}, true) returning id
    `;
    row = inserted[0] as { id: string };
    created = true;
  } else {
    await db`update users set email_verified = true where id = ${row.id} and not email_verified`;
  }
  const credential = await db`
    select 1 from accounts where user_id = ${row.id} and provider_id = 'credential' limit 1
  `;
  if (credential.length === 0) {
    await db`
      insert into accounts (user_id, account_id, provider_id, password)
      values (${row.id}, ${row.id}, 'credential', ${hashPassword(password)})
    `;
  }
  seeded = true;
  return { created };
}
