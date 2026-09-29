import { createHash, randomBytes } from "node:crypto";
import disposableDomains from "disposable-email-domains/index.json";
import { currentSignupMode } from "@/lib/console-settings";
import { sql } from "@/lib/sql";
import { isSuspendedRow } from "@/lib/suspension";

// Sign-up gate and invites (docs/specs/finished/multi-user-accounts.md §2.3). The waitlist that
// hands out invites is lib/waitlist.ts (docs/specs/waitlist.md).

export const INVITE_COOKIE = "hsw_invite";
/** Invites the admin makes by hand. Waitlist invites expire sooner (lib/waitlist.ts). */
export const INVITE_DAYS = 14;

const DISPOSABLE = new Set<string>(disposableDomains as string[]);

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DISPOSABLE.has(domain);
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export type InviteRow = {
  id: string;
  code_prefix: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

export async function createInvite(input: {
  email?: string | null;
  createdBy: string | null;
  days?: number;
}): Promise<{ id: string; code: string }> {
  const code = `inv_${randomBytes(18).toString("base64url")}`;
  const email = input.email ? normalizeEmail(input.email) : null;
  const rows = await sql()`
    insert into invites (code_hash, code_prefix, email, created_by, expires_at)
    values (${hashCode(code)}, ${code.slice(0, 8)}, ${email}, ${input.createdBy},
            now() + make_interval(days => ${input.days ?? INVITE_DAYS}))
    returning id
  `;
  return { id: (rows[0] as { id: string }).id, code };
}

/** An invite that can still create an account for this email, or null. */
export async function findUsableInvite(
  code: string | null | undefined,
  email: string,
): Promise<InviteRow | null> {
  if (!code || !code.startsWith("inv_")) return null;
  const rows = await sql()`
    select * from invites
    where code_hash = ${hashCode(code)}
      and used_at is null and revoked_at is null and expires_at > now()
    limit 1
  `;
  const row = rows[0] as InviteRow | undefined;
  if (!row) return null;
  if (row.email && row.email !== normalizeEmail(email)) return null;
  return row;
}

/**
 * Marks the invite used for this sign-up, in one statement, before the account is created:
 * of two sign-ups racing with one code, only the first gets a row back. Same conditions as
 * findUsableInvite, plus the disposable-address rule of signupDecision.
 */
async function claimInvite(
  code: string | null | undefined,
  email: string,
): Promise<InviteRow | null> {
  if (!code || !code.startsWith("inv_")) return null;
  const normalized = normalizeEmail(email);
  const rows = await sql()`
    update invites set used_at = now()
    where code_hash = ${hashCode(code)}
      and used_at is null and revoked_at is null and expires_at > now()
      and (email = ${normalized} or (email is null and not ${isDisposableEmail(email)}::boolean))
    returning *
  `;
  return (rows[0] as InviteRow | undefined) ?? null;
}

/** Records who used the invite this sign-up claimed (signupDecision with `claim`). */
export async function consumeInvite(code: string | null | undefined, userId: string) {
  if (!code || !code.startsWith("inv_")) return;
  await sql()`
    update invites set used_by = ${userId}
    where code_hash = ${hashCode(code)} and used_by is null
      and used_at > now() - interval '1 hour'
  `;
}

export const INVITE_STATES = ["all", "open", "used", "revoked", "expired"] as const;
export type InviteState = (typeof INVITE_STATES)[number];

/** One page of invites, newest first, filtered by state (docs/specs/finished/admin-tools.md §2.7). */
export async function listInvites(input: {
  state: InviteState;
  page: number;
  pageSize: number;
}): Promise<{ rows: InviteRow[]; total: number }> {
  const { state, pageSize } = input;
  const offset = (input.page - 1) * pageSize;
  const rows = await sql()`
    select id, code_prefix, email, expires_at, used_at, used_by, revoked_at, created_at,
      count(*) over ()::int as total
    from invites
    where ${state} = 'all'
      or (${state} = 'used' and used_at is not null)
      or (${state} = 'revoked' and used_at is null and revoked_at is not null)
      or (${state} = 'open' and used_at is null and revoked_at is null and expires_at > now())
      or (${state} = 'expired' and used_at is null and revoked_at is null and expires_at <= now())
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const total = rows[0] ? Number((rows[0] as { total: number }).total) : 0;
  return { rows: rows as InviteRow[], total };
}

export async function getInvite(id: string): Promise<InviteRow | null> {
  const rows = await sql()`
    select id, code_prefix, email, expires_at, used_at, used_by, revoked_at, created_at
    from invites where id = ${id}
  `;
  return (rows[0] as InviteRow | undefined) ?? null;
}

export async function revokeInvite(id: string) {
  await sql()`update invites set revoked_at = now() where id = ${id} and used_at is null`;
}

export async function userExists(email: string): Promise<boolean> {
  const rows = await sql()`select 1 from users where email = ${normalizeEmail(email)} limit 1`;
  return rows.length > 0;
}

/** "none" when no account uses this email, else whether it may sign in. */
export async function accountStatus(email: string): Promise<"none" | "active" | "suspended"> {
  const rows = await sql()`
    select banned, ban_expires from users where email = ${normalizeEmail(email)} limit 1
  `;
  const row = rows[0] as { banned: boolean; ban_expires: string | null } | undefined;
  if (!row) return "none";
  return isSuspendedRow(row) ? "suspended" : "active";
}

/**
 * Whether a new account may be created for `email`. Returns the invite it uses (invite and
 * waitlist modes) or null (open mode). Throws nothing; `allowed: false` means refuse.
 * With `claim`, the invite is also marked used in the same statement that checks it; the
 * account creation hook uses this so one code creates one account.
 */
export async function signupDecision(
  email: string,
  inviteCode: string | null | undefined,
  options: { claim?: boolean } = {},
): Promise<{ allowed: boolean; invite: InviteRow | null }> {
  const mode = await currentSignupMode();
  if (mode === "closed") return { allowed: false, invite: null };
  if (mode === "open") return { allowed: !isDisposableEmail(email), invite: null };
  if (options.claim) {
    const claimed = await claimInvite(inviteCode, email);
    return { allowed: Boolean(claimed), invite: claimed };
  }
  const invite = await findUsableInvite(inviteCode, email);
  if (!invite) return { allowed: false, invite: null };
  // An invite the admin tied to this exact address overrides the disposable list.
  if (!invite.email && isDisposableEmail(email)) return { allowed: false, invite: null };
  return { allowed: true, invite };
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
