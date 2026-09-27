import { effectiveLimits, type AccountLimits } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// Per-account limits (docs/specs/finished/multi-user-accounts.md §2.4).

export async function accountLimits(userId: string): Promise<AccountLimits> {
  const rows = await sql()`select limits from users where id = ${userId}`;
  return effectiveLimits((rows[0] as { limits?: unknown } | undefined)?.limits);
}

/** "switches" / "bridges" when this register would create one past the limit, else null. */
export async function registerLimitHit(input: {
  userId: string;
  limits: AccountLimits;
  mac: string | null;
  bridgeid: string;
}): Promise<"switches" | "bridges" | null> {
  const db = sql();
  const bridge = await db`
    select 1 from bridges where user_id = ${input.userId} and bridgeid = ${input.bridgeid}
  `;
  if (bridge.length === 0) {
    const count = await db`select count(*)::int as n from bridges where user_id = ${input.userId}`;
    if ((count[0] as { n: number }).n >= input.limits.bridges) return "bridges";
  }
  if (input.mac) {
    const sw = await db`
      select 1 from switches where user_id = ${input.userId} and mac = ${input.mac}
    `;
    if (sw.length === 0) {
      const count = await db`select count(*)::int as n from switches where user_id = ${input.userId}`;
      if ((count[0] as { n: number }).n >= input.limits.switches) return "switches";
    }
  }
  return null;
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

export async function activeKeyCount(userId: string): Promise<number> {
  const rows = await sql()`
    select count(*)::int as n from device_api_keys where user_id = ${userId} and revoked_at is null
  `;
  return (rows[0] as { n: number }).n;
}
