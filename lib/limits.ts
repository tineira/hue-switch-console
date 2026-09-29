import { effectiveLimits, type AccountLimits } from "@/lib/account-config";
import { sql } from "@/lib/sql";
import type { TopologySnapshot } from "@/lib/types";

// Per-account limits (docs/specs/finished/multi-user-accounts.md §2.4).

export async function accountLimits(userId: string): Promise<AccountLimits> {
  const rows = await sql()`select limits from users where id = ${userId}`;
  return effectiveLimits((rows[0] as { limits?: unknown } | undefined)?.limits);
}

/**
 * Key for pg_advisory_xact_lock: one per account. Every check-and-insert against a per-account
 * limit takes it first in its transaction, so parallel requests are counted one at a time.
 */
export function accountLimitLockKey(userId: string): string {
  return `account-limits:${userId}`;
}

/**
 * "switches" / "bridges" when this register would create one past the limit, else null.
 * Counting and creating happen in one transaction under the account lock: a new Bridge is
 * stored with the request's snapshot and a new switch as a bare row (mac, bridgeid, label),
 * both or neither, so parallel registers cannot exceed a limit. upsertBridge and
 * upsertSwitch then fill them in as for any existing row. Updates are never refused.
 */
export async function registerLimitHit(input: {
  userId: string;
  limits: AccountLimits;
  mac: string | null;
  bridgeid: string;
  snapshot: TopologySnapshot;
  label?: string;
}): Promise<"switches" | "bridges" | null> {
  const { userId, limits, mac, bridgeid, snapshot } = input;
  const lockKey = accountLimitLockKey(userId);
  const payload = JSON.stringify(snapshot);
  const results = await sql().transaction((tx) => [
    tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    // A new Bridge only when both it and, for a switch register, the switch fit.
    tx`
      insert into bridges (user_id, bridgeid, bridge_ip, snapshot, updated_at)
      select ${userId}, ${bridgeid}, ${snapshot.bridgeIp ?? null}, ${payload}::jsonb, now()
      where (select count(*) from bridges where user_id = ${userId}) < ${limits.bridges}
        and (
          ${mac}::text is null
          or exists (select 1 from switches where user_id = ${userId} and mac = ${mac})
          or (select count(*) from switches where user_id = ${userId}) < ${limits.switches}
        )
      on conflict (user_id, bridgeid) do nothing
    `,
    tx`
      insert into switches (user_id, mac, label, bridgeid)
      select ${userId}, ${mac}, ${input.label ?? null}, ${bridgeid}
      where ${mac}::text is not null
        and exists (select 1 from bridges where user_id = ${userId} and bridgeid = ${bridgeid})
        and (select count(*) from switches where user_id = ${userId}) < ${limits.switches}
      on conflict (user_id, mac) do nothing
    `,
    tx`
      select
        exists (select 1 from bridges where user_id = ${userId} and bridgeid = ${bridgeid})
          as has_bridge,
        (${mac}::text is null
          or exists (select 1 from switches where user_id = ${userId} and mac = ${mac}))
          as has_switch,
        (select count(*) from bridges where user_id = ${userId})::int as bridge_count
    `,
  ]);
  const row = results[results.length - 1]?.[0] as
    | { has_bridge: boolean; has_switch: boolean; bridge_count: number }
    | undefined;
  if (!row) return "bridges";
  if (row.has_bridge && row.has_switch) return null;
  // A new Bridge held back only because the switch did not fit is a switch refusal.
  if (!row.has_bridge && row.bridge_count >= limits.bridges) return "bridges";
  return "switches";
}

export async function recordRegisterRefused(userId: string, reason: string) {
  await sql()`
    update users set register_refused_at = now(), register_refused_reason = ${reason}
    where id = ${userId}
  `;
}

export async function lastRegisterRefusal(
  userId: string,
): Promise<{ at: string; reason: string } | null> {
  const rows = await sql()`
    select register_refused_at, register_refused_reason from users
    where id = ${userId} and register_refused_at > now() - interval '7 days'
  `;
  const row = rows[0] as
    | { register_refused_at: string | Date; register_refused_reason: string | null }
    | undefined;
  if (!row) return null;
  return {
    at: new Date(row.register_refused_at).toISOString(),
    reason: row.register_refused_reason ?? "unknown",
  };
}
