import { createHash, randomBytes } from "node:crypto";
import { adminEmails } from "@/lib/account-config";
import {
  countJoin,
  currentSignupMode,
  currentUserCap,
  markCapAlertSent,
  readSettings,
} from "@/lib/console-settings";
import { sendAdminAlert, sendInvite, sendWaitlistConfirmation, waitlistEmailsLeft, type EmailTag } from "@/lib/email";
import { siteOrigin } from "@/lib/origin";
import { createInvite, revokeInvite, userExists } from "@/lib/signup";
import { sql } from "@/lib/sql";

// The waitlist with a user cap (docs/specs/finished/waitlist.md). Entries live in invite_requests.
// In `waitlist` mode, entries are admitted oldest first while seats are free; in `invite` mode
// they wait for the admin.

/** Waitlist invites expire sooner than the admin's, so unused seats come back quickly (§2.3). */
export const WAITLIST_INVITE_DAYS = 7;

/** At most this many admissions per run, so one run stays well inside a function's time limit. */
const MAX_ADMIT_PER_RUN = 25;

export type WaitlistStatus =
  | "pending"
  | "approved"
  | "dismissed"
  | "expired"
  | "left"
  | "bounced"
  | "complained";

export type WaitlistEntry = {
  id: string;
  email: string;
  status: WaitlistStatus;
  created_at: string;
  decided_at: string | null;
  confirmation_sent_at: string | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Seats used = accounts + invites that can still create one (§2.3). */
export async function seatsUsed(): Promise<{ accounts: number; invites: number; total: number }> {
  const rows = await sql()`
    select
      (select count(*)::int from users) as accounts,
      (select count(*)::int from invites
        where used_at is null and revoked_at is null and expires_at > now()) as invites
  `;
  const accounts = Number(rows[0]?.accounts ?? 0);
  const invites = Number(rows[0]?.invites ?? 0);
  return { accounts, invites, total: accounts + invites };
}

/** Waitlist invites that ran out unused: their entry is `expired`, and the seat is free again. */
async function expireWaitlistInvites() {
  await sql()`
    update invite_requests r set status = 'expired', decided_at = now()
    from invites i
    where r.invite_id = i.id and r.status = 'approved'
      and i.used_at is null and i.revoked_at is null and i.expires_at <= now()
  `;
}

/**
 * Invites one entry and emails the link. The entry is claimed first, so two runs never invite
 * the same person; if the email fails, the claim is undone and the entry keeps its place.
 */
export async function admitEntry(
  id: string,
  createdBy: string | null,
  origin: string,
): Promise<boolean> {
  const claimed = await sql()`
    update invite_requests set status = 'approved', decided_at = now()
    where id = ${id} and status = 'pending'
    returning email
  `;
  const email = claimed[0]?.email as string | undefined;
  if (!email) return false;
  const invite = await createInvite({ email, createdBy, days: WAITLIST_INVITE_DAYS });
  try {
    await sendInvite(email, `${origin}/login?invite=${invite.code}`, {
      waitlist: true,
      days: WAITLIST_INVITE_DAYS,
    });
  } catch (err) {
    await revokeInvite(invite.id);
    await sql()`
      update invite_requests set status = 'pending', decided_at = null, invite_id = null
      where id = ${id}
    `;
    throw err;
  }
  await sql()`update invite_requests set invite_id = ${invite.id} where id = ${id}`;
  return true;
}

/**
 * Admits the oldest pending entries while seats and today's waitlist email budget last.
 * Runs on join, cap change, a freed seat, and in the daily cron (§2.3). Returns how many.
 */
export async function admitFromWaitlist(origin?: string): Promise<number> {
  await expireWaitlistInvites();
  const settings = await readSettings();
  if ((await currentSignupMode(settings)) !== "waitlist") return 0;

  const cap = await currentUserCap(settings);
  const free = cap === null ? Infinity : cap - (await seatsUsed()).total;
  const budget = await waitlistEmailsLeft();
  const n = Math.min(free, budget, MAX_ADMIT_PER_RUN);
  let admitted = 0;
  if (n > 0) {
    const base = origin ?? (await siteOrigin());
    const rows = await sql()`
      select id from invite_requests where status = 'pending'
      order by created_at asc limit ${n}
    `;
    for (const row of rows) {
      try {
        if (await admitEntry(String(row.id), null, base)) admitted++;
      } catch (err) {
        // Leave the rest for the next run (email provider down or over its limit).
        console.error("waitlist admission failed", err);
        break;
      }
    }
  }
  await checkCapAlerts();
  return admitted;
}

/** Runs admission without letting a failure break the page or request that triggered it. */
export async function admitQuietly(origin?: string) {
  try {
    await admitFromWaitlist(origin);
  } catch (err) {
    console.error("waitlist admission failed", err);
  }
}

/** Emails the admins once when seats first reach 80% and 100% of the cap (§2.7). */
async function checkCapAlerts() {
  const settings = await readSettings();
  if ((await currentSignupMode(settings)) !== "waitlist") return;
  const cap = await currentUserCap(settings);
  if (!cap) return;
  const { total } = await seatsUsed();
  const threshold = total >= cap ? 100 : total >= Math.ceil(cap * 0.8) ? 80 : 0;
  if (threshold <= (settings.capAlertSent ?? 0)) return;
  const pending = await pendingCount();
  const subject =
    threshold === 100
      ? `Hue Switch Console is full (${total} of ${cap} seats)`
      : `Hue Switch Console is at ${total} of ${cap} seats`;
  const text = `${total} of ${cap} seats are used (accounts plus unused invites), and ${pending} people are waiting.\n\nRaise the cap in /admin when the servers can take more users.`;
  for (const to of adminEmails()) {
    try {
      await sendAdminAlert(to, subject, text);
    } catch (err) {
      console.error("cap alert not sent", err);
      return;
    }
  }
  await markCapAlertSent(threshold);
}

async function pendingCount(): Promise<number> {
  const rows = await sql()`select count(*)::int as n from invite_requests where status = 'pending'`;
  return Number(rows[0]?.n ?? 0);
}

export type JoinResult = "ok" | "undeliverable";

/**
 * The "Join the waitlist" form (§2.4). The caller shows the same reply for every "ok", so the
 * form never tells anyone whether an address has an account or is already waiting.
 */
export async function joinWaitlist(email: string, ip: string | null): Promise<JoinResult> {
  await sql()`insert into auth_events (kind, email, ip) values ('invite_requested', ${email}, ${ip})`;
  if (await userExists(email)) return "ok";

  const previous = await sql()`
    select status from invite_requests
    where lower(email) = ${email}
      and (status in ('pending', 'bounced', 'complained')
        or (status = 'approved' and invite_id in (
          select id from invites where used_at is null and revoked_at is null and expires_at > now())))
    order by created_at desc limit 1
  `;
  const status = previous[0]?.status as WaitlistStatus | undefined;
  if (status === "bounced" || status === "complained") return "undeliverable";
  if (status) return "ok";

  const token = `wl_${randomBytes(18).toString("base64url")}`;
  const inserted = await sql()`
    insert into invite_requests (email, leave_token_hash)
    values (${email}, ${hashToken(token)})
    on conflict do nothing
    returning id
  `;
  const id = inserted[0]?.id as string | undefined;
  if (!id) return "ok";
  await countJoin();

  if ((await currentSignupMode()) !== "waitlist") return "ok";
  const origin = await siteOrigin();
  await admitQuietly(origin);

  // Still waiting: say so once, if today's budget allows (§2.6). Skipping it costs nothing
  // but the email; the entry keeps its place.
  const still = await sql()`select status from invite_requests where id = ${id}`;
  if (still[0]?.status !== "pending" || (await waitlistEmailsLeft()) <= 0) return "ok";
  try {
    await sendWaitlistConfirmation(email, `${origin}/waitlist/leave?token=${token}`);
    await sql()`update invite_requests set confirmation_sent_at = now() where id = ${id}`;
  } catch (err) {
    console.error("waitlist confirmation not sent", err);
  }
  return "ok";
}

/** The pending entry a leave link points at, or null. */
export async function findByLeaveToken(token: string): Promise<{ id: string; email: string } | null> {
  if (!token.startsWith("wl_")) return null;
  const rows = await sql()`
    select id, email from invite_requests
    where leave_token_hash = ${hashToken(token)} and status = 'pending'
  `;
  const row = rows[0];
  return row ? { id: String(row.id), email: String(row.email) } : null;
}

export async function leaveWaitlist(token: string): Promise<boolean> {
  if (!token.startsWith("wl_")) return false;
  const rows = await sql()`
    update invite_requests set status = 'left', decided_at = now()
    where leave_token_hash = ${hashToken(token)} and status = 'pending'
    returning id
  `;
  return rows.length > 0;
}

export async function dismissEntry(id: string) {
  await sql()`
    update invite_requests set status = 'dismissed', decided_at = now()
    where id = ${id} and status = 'pending'
  `;
}

export async function listPendingEntries(): Promise<WaitlistEntry[]> {
  const rows = await sql()`
    select id, email, status, created_at, decided_at, confirmation_sent_at from invite_requests
    where status = 'pending' order by created_at asc limit 200
  `;
  return rows as WaitlistEntry[];
}

/**
 * A bounce, complaint or suppression reported by Resend (§2.5). Takes the address off the
 * waitlist, revokes an unused waitlist invite to it (freeing the seat), and logs the event.
 * Returns true when a seat was freed. Safe to run twice for the same event.
 */
export async function markUndeliverable(
  email: string,
  kind: "bounced" | "complained",
  tag: EmailTag | null,
): Promise<boolean> {
  await sql()`
    insert into auth_events (kind, email, detail)
    values (${kind === "bounced" ? "email_bounced" : "email_complained"}, ${email}, ${tag})
  `;
  await sql()`
    update invite_requests set status = ${kind}, decided_at = now()
    where lower(email) = ${email} and status = 'pending'
  `;
  const invites = await sql()`
    select r.id as request_id, i.id as invite_id
    from invite_requests r join invites i on i.id = r.invite_id
    where lower(r.email) = ${email} and r.status = 'approved'
      and i.used_at is null and i.revoked_at is null
  `;
  for (const row of invites) {
    await revokeInvite(String(row.invite_id));
    await sql()`
      update invite_requests set status = ${kind}, decided_at = now() where id = ${row.request_id}
    `;
  }
  return invites.length > 0;
}

export type WaitlistStats = {
  pending: number;
  joined7: number;
  joined30: number;
  joinsTotal: number;
  admitted: number;
  left: number;
  expired: number;
  dismissed: number;
  bounced: number;
  complained: number;
};

/** Counts for /admin. Entries other than pending are kept 90 days, so those counts cover 90 days. */
export async function waitlistStats(): Promise<WaitlistStats> {
  const [rows, settings] = await Promise.all([
    sql()`
      select
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where created_at > now() - interval '7 days')::int as joined7,
        count(*) filter (where created_at > now() - interval '30 days')::int as joined30,
        count(*) filter (where status = 'approved')::int as admitted,
        count(*) filter (where status = 'left')::int as left_,
        count(*) filter (where status = 'expired')::int as expired,
        count(*) filter (where status = 'dismissed')::int as dismissed,
        count(*) filter (where status = 'bounced')::int as bounced,
        count(*) filter (where status = 'complained')::int as complained
      from invite_requests
    `,
    readSettings(),
  ]);
  const r = rows[0] ?? {};
  return {
    pending: Number(r.pending ?? 0),
    joined7: Number(r.joined7 ?? 0),
    joined30: Number(r.joined30 ?? 0),
    joinsTotal: settings.joinsTotal,
    admitted: Number(r.admitted ?? 0),
    left: Number(r.left_ ?? 0),
    expired: Number(r.expired ?? 0),
    dismissed: Number(r.dismissed ?? 0),
    bounced: Number(r.bounced ?? 0),
    complained: Number(r.complained ?? 0),
  };
}

/** Bounces and complaints in the last 30 days, per kind of email (§2.7). */
export async function deliveryProblems(): Promise<{ kind: string; tag: string; n: number }[]> {
  const rows = await sql()`
    select kind, coalesce(detail, 'unknown') as tag, count(*)::int as n from auth_events
    where kind in ('email_bounced', 'email_complained') and created_at > now() - interval '30 days'
    group by kind, detail order by kind, detail
  `;
  return rows.map((r) => ({ kind: String(r.kind), tag: String(r.tag), n: Number(r.n) }));
}

/** Load numbers for deciding when the cap can go up (§2.7). */
export async function loadStats(): Promise<{ switches: number; dbBytes: number }> {
  const rows = await sql()`
    select (select count(*)::int from switches) as switches,
      pg_database_size(current_database())::bigint as db_bytes
  `;
  return { switches: Number(rows[0]?.switches ?? 0), dbBytes: Number(rows[0]?.db_bytes ?? 0) };
}
