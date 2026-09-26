import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { sql } from "@/lib/sql";

export const dynamic = "force-dynamic";

// Daily housekeeping (docs/specs/multi-user-accounts.md §2.8). Never deletes accounts.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError(503, "cron_not_configured");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "unauthorized");
  }
  if (!isDbConfigured()) return jsonError(503, "database_not_configured");
  await ensureSchema();
  const db = sql();
  const events = await db`delete from auth_events where created_at < now() - interval '7 days' returning id`;
  const verifications = await db`delete from verifications where expires_at < now() - interval '7 days' returning id`;
  const sessions = await db`delete from sessions where expires_at < now() returning id`;
  const requests = await db`
    delete from invite_requests where created_at < now() - interval '90 days' and status <> 'approved'
    returning id
  `;
  const limits = await db`
    delete from rate_limits where last_request < ${Date.now() - 24 * 60 * 60 * 1000}
    returning id
  `;
  return jsonOk({
    ok: true,
    deleted: {
      auth_events: events.length,
      verifications: verifications.length,
      sessions: sessions.length,
      invite_requests: requests.length,
      rate_limits: limits.length,
    },
  });
}
