import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/account-config";
import { auth } from "@/lib/better-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";
import { loginHref, PATH_HEADER, safeReturnPath } from "@/lib/return-path";
import { sql } from "@/lib/sql";
import { isSuspended } from "@/lib/suspension";
import { pendingDocuments, type TermsDocument } from "@/lib/terms";

// Human sessions are Better Auth sessions (docs/specs/finished/multi-user-accounts.md §2.2).
// Pages and routes keep calling getSessionUser / requireSessionUser.

export type SessionUser = {
  id: string;
  email?: string;
  /** Documents still to accept (docs/specs/finished/terms-and-safety.md §2.4); empty once accepted. */
  pending: TermsDocument[];
};

/**
 * The signed-in person, or null. Someone who has not accepted the current Safety notice and
 * Terms counts as signed out (so session API routes answer 401), unless `allowPending` is set:
 * /accept, and pages that send them there, need to see them.
 */
export async function getSessionUser(
  opts: { allowPending?: boolean } = {},
): Promise<SessionUser | null> {
  if (!isDbConfigured()) return null;
  await ensureSchema();
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  // A suspension past its end date no longer counts (docs/specs/finished/admin-tools.md §2.6).
  if (session.user.banned && (await isSuspended(session.user.id))) return null;
  const pending = await pendingDocuments(session.user.id);
  if (pending.length > 0 && !opts.allowPending) return null;
  return { id: session.user.id, email: session.user.email, pending };
}

/** `/accept`, carrying `next` when it is somewhere other than the home page. */
export function acceptHref(next: string | null | undefined): string {
  const path = safeReturnPath(next);
  return path === "/" ? "/accept" : `/accept?next=${encodeURIComponent(path)}`;
}

export async function requireSessionUser(): Promise<SessionUser> {
  // Sign-in, and acceptance, come back to this page (proxy.ts sets the header).
  const path = async () => (await headers()).get(PATH_HEADER);
  if (!isDbConfigured()) redirect(loginHref(await path()));
  const user = await getSessionUser({ allowPending: true });
  if (!user) redirect(loginHref(await path()));
  if (user.pending.length > 0) redirect(acceptHref(await path()));
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
    select password from accounts where user_id = ${row.id} and provider_id = 'credential' limit 1
  `;
  const stored = (credential[0] as { password?: string | null } | undefined)?.password;
  if (credential.length === 0) {
    await db`
      insert into accounts (user_id, account_id, provider_id, password)
      values (${row.id}, ${row.id}, 'credential', ${hashPassword(password)})
    `;
  } else if (!stored || !verifyPassword(password, stored)) {
    // USER_PASSWORD changed in env: the seeded account follows it.
    await db`
      update accounts set password = ${hashPassword(password)}
      where user_id = ${row.id} and provider_id = 'credential'
    `;
  }
  seeded = true;
  return { created };
}
