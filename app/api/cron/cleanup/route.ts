import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { bearerToken, jsonError, jsonOk } from "@/lib/http";
import { sql } from "@/lib/sql";
import { secretMatches } from "@/lib/tokens";
import { admitFromWaitlist } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

// Daily housekeeping (docs/specs/finished/multi-user-accounts.md §2.8). Never deletes accounts.
// Also the waitlist's catch-up admission run (docs/specs/waitlist.md §2.3).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError(503, "cron_not_configured");
  if (!secretMatches(bearerToken(req), secret)) {
    return jsonError(401, "unauthorized");
  }
  if (!isDbConfigured()) return jsonError(503, "database_not_configured");
  await ensureSchema();
  const db = sql();
  // Bounces and complaints are kept 30 days for the counts in /admin; the rest 7 days.
  const events = await db`
    delete from auth_events
    where (kind in ('email_bounced', 'email_complained') and created_at < now() - interval '30 days')
       or (kind not in ('email_bounced', 'email_complained') and created_at < now() - interval '7 days')
    returning id
  `;
  const verifications = await db`delete from verifications where expires_at < now() - interval '7 days' returning id`;
  const sessions = await db`delete from sessions where expires_at < now() returning id`;
  // Pending entries keep their place however long they wait. Others go 90 days after they
  // were decided; an approved entry stays while its invite is still open.
  const requests = await db`
    delete from invite_requests r
    where r.status <> 'pending'
      and coalesce(r.decided_at, r.created_at) < now() - interval '90 days'
      and not (r.status = 'approved' and exists (
        select 1 from invites i
        where i.id = r.invite_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()))
    returning id
  `;
  const limits = await db`
    delete from rate_limits where last_request < ${Date.now() - 24 * 60 * 60 * 1000}
    returning id
  `;
  // Suspensions past their end date, and admin events older than a year (admin-tools §2.5, §2.6).
  const unsuspended = await db`
    update users set banned = false, ban_reason = null, ban_expires = null
    where banned and ban_expires is not null and ban_expires <= now()
    returning id
  `;
  const adminEvents = await db`
    delete from admin_events where created_at < now() - interval '1 year' returning id
  `;
  let admitted = 0;
  try {
    admitted = await admitFromWaitlist();
  } catch (err) {
    console.error("waitlist admission failed", err);
  }
  return jsonOk({
    ok: true,
    admitted,
    unsuspended: unsuspended.length,
    deleted: {
      auth_events: events.length,
      verifications: verifications.length,
      sessions: sessions.length,
      invite_requests: requests.length,
      rate_limits: limits.length,
      admin_events: adminEvents.length,
    },
  });
}
