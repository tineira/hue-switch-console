import { createHash, randomBytes } from "node:crypto";
import disposableDomains from "disposable-email-domains/index.json";
import { signupMode } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// Sign-up gate, invites and invite requests (docs/specs/multi-user-accounts.md §2.3).

export const INVITE_COOKIE = "hsw_invite";
const INVITE_DAYS = 14;

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
}): Promise<{ id: string; code: string }> {
  const code = `inv_${randomBytes(18).toString("base64url")}`;
  const email = input.email ? normalizeEmail(input.email) : null;
  const rows = await sql()`
    insert into invites (code_hash, code_prefix, email, created_by, expires_at)
    values (${hashCode(code)}, ${code.slice(0, 8)}, ${email}, ${input.createdBy},
            now() + make_interval(days => ${INVITE_DAYS}))
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

export async function consumeInvite(inviteId: string, userId: string) {
  await sql()`
    update invites set used_at = now(), used_by = ${userId}
    where id = ${inviteId} and used_at is null
  `;
}

export async function listInvites(): Promise<InviteRow[]> {
  const rows = await sql()`
    select id, code_prefix, email, expires_at, used_at, used_by, revoked_at, created_at
    from invites order by created_at desc limit 200
  `;
  return rows as InviteRow[];
}

export async function revokeInvite(id: string) {
  await sql()`update invites set revoked_at = now() where id = ${id} and used_at is null`;
}

export async function userExists(email: string): Promise<boolean> {
  const rows = await sql()`select 1 from users where email = ${normalizeEmail(email)} limit 1`;
  return rows.length > 0;
}

/**
 * Whether a new account may be created for `email`. Returns the invite to consume
 * (invite mode) or null (open mode). Throws nothing; `allowed: false` means refuse.
 */
export async function signupDecision(
  email: string,
  inviteCode: string | null | undefined,
): Promise<{ allowed: boolean; invite: InviteRow | null }> {
  const mode = signupMode();
  if (mode === "closed") return { allowed: false, invite: null };
  if (mode === "open") return { allowed: !isDisposableEmail(email), invite: null };
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

// ---- Invite requests ----

export type InviteRequestRow = {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  decided_at: string | null;
};

/** Stores a request unless the email has an account or a pending request. */
export async function storeInviteRequest(email: string, note: string | null, ip: string | null) {
  await sql()`
    insert into auth_events (kind, email, ip) values ('invite_requested', ${email}, ${ip})
  `;
  if (await userExists(email)) return;
  await sql()`
    insert into invite_requests (email, note)
    values (${email}, ${note})
    on conflict do nothing
  `;
}

export async function listPendingInviteRequests(): Promise<InviteRequestRow[]> {
  const rows = await sql()`
    select id, email, note, status, created_at, decided_at from invite_requests
    where status = 'pending' order by created_at asc limit 200
  `;
  return rows as InviteRequestRow[];
}

export async function getInviteRequest(id: string): Promise<InviteRequestRow | null> {
  const rows = await sql()`
    select id, email, note, status, created_at, decided_at from invite_requests where id = ${id}
  `;
  return (rows[0] as InviteRequestRow | undefined) ?? null;
}

export async function decideInviteRequest(
  id: string,
  status: "approved" | "dismissed",
  inviteId: string | null,
) {
  await sql()`
    update invite_requests set status = ${status}, invite_id = ${inviteId}, decided_at = now()
    where id = ${id} and status = 'pending'
  `;
}
