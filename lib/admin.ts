import { isAdminEmail } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// /admin queries (docs/specs/finished/multi-user-accounts.md §2.7, docs/specs/finished/admin-tools.md).
// Counts only: no recipes or topology.

export const PAGE_SIZE = 50;

export type AdminAccountRow = {
  id: string;
  email: string;
  methods: string[];
  created_at: string;
  last_login_at: string | null;
  switches: number;
  bridges: number;
  last_board_seen: string | null;
  /** Suspended now: set, and no end date or one still ahead. */
  suspended: boolean;
  ban_reason: string | null;
  ban_expires: string | null;
  limits: Record<string, number>;
  dormant: boolean;
  /** The last register refusal, when it is newer than the last board seen. */
  refused: { at: string; reason: string } | null;
};

export const SORTS = {
  email: "email",
  created: "created_at",
  login: "last_login_at",
  switches: "switches",
  bridges: "bridges",
  seen: "last_board_seen",
  status: "suspended",
} as const;

export type SortKey = keyof typeof SORTS;

export const LIMIT_KEYS = ["switches", "bridges", "keys", "snapshotKb"] as const;

// One row per account. Grouped joins, not a subquery per row. Dormant: no switch and no
// sign-in for 60 days (accounts spec §2.8).
const ACCOUNTS = `
  with sw as (
    select user_id, count(*)::int as n, max(last_seen_at) as seen from switches group by user_id
  ), br as (
    select user_id, count(*)::int as n from bridges group by user_id
  ), am as (
    select user_id, array_agg(provider_id order by provider_id) as methods from accounts group by user_id
  ), base as (
    select u.id, u.email, u.created_at, u.last_login_at, u.limits,
      u.ban_reason, u.ban_expires, u.register_refused_at, u.register_refused_reason,
      coalesce(am.methods, '{}') as methods,
      coalesce(sw.n, 0) as switches,
      coalesce(br.n, 0) as bridges,
      sw.seen as last_board_seen,
      (u.banned and (u.ban_expires is null or u.ban_expires > now())) as suspended,
      (coalesce(sw.n, 0) = 0 and coalesce(u.last_login_at, u.created_at) < now() - interval '60 days') as dormant
    from users u
    left join sw on sw.user_id = u.id
    left join br on br.user_id = u.id
    left join am on am.user_id = u.id
    where $1 = '' or u.email ilike '%' || $1 || '%'
  )`;

/** `q` as an ILIKE substring: its own % and _ match themselves. */
function likeText(q: string): string {
  return q.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
}

function iso(value: unknown): string | null {
  return value ? new Date(value as string).toISOString() : null;
}

export async function listAccounts(input: {
  q: string;
  sort: SortKey;
  desc: boolean;
  dormantOnly: boolean;
  page: number;
}): Promise<{ rows: AdminAccountRow[]; matching: number; dormant: number; total: number }> {
  const db = sql();
  const q = likeText(input.q);
  // The sort column comes from SORTS, never from the request.
  const order = `${SORTS[input.sort]} ${input.desc ? "desc" : "asc"} nulls last, id`;
  const [rows, counts] = await Promise.all([
    db.query(
      `${ACCOUNTS} select * from base where not $2 or dormant order by ${order} limit $3 offset $4`,
      [q, input.dormantOnly, PAGE_SIZE, (input.page - 1) * PAGE_SIZE],
    ),
    db.query(
      `${ACCOUNTS} select count(*)::int as matching,
         count(*) filter (where dormant)::int as dormant,
         (select count(*)::int from users) as total
       from base`,
      [q],
    ),
  ]);
  const c = counts[0] as { matching: number; dormant: number; total: number };
  return {
    rows: (rows as Record<string, unknown>[]).map((r) => {
      const seen = iso(r.last_board_seen);
      const refusedAt = iso(r.register_refused_at);
      return {
        id: String(r.id),
        email: String(r.email),
        methods: (r.methods as string[]) ?? [],
        created_at: iso(r.created_at) as string,
        last_login_at: iso(r.last_login_at),
        switches: Number(r.switches),
        bridges: Number(r.bridges),
        last_board_seen: seen,
        suspended: Boolean(r.suspended),
        ban_reason: (r.ban_reason as string | null) ?? null,
        ban_expires: iso(r.ban_expires),
        limits: (r.limits as Record<string, number>) ?? {},
        dormant: Boolean(r.dormant),
        refused:
          refusedAt && (!seen || refusedAt > seen)
            ? { at: refusedAt, reason: String(r.register_refused_reason ?? "") }
            : null,
      };
    }),
    matching: input.dormantOnly ? c.dormant : c.matching,
    dormant: c.dormant,
    total: c.total,
  };
}

async function emailOf(userId: string): Promise<string | null> {
  const rows = await sql()`select email from users where id = ${userId}`;
  return (rows[0] as { email?: string } | undefined)?.email ?? null;
}

/**
 * Suspends (with a reason and an optional end date) or lifts a suspension. Refuses an admin
 * address whoever calls it (§2.2). Returns the account's email, or null when refused or missing.
 */
export async function setSuspension(
  userId: string,
  suspension: { reason: string | null; expires: Date | null } | null,
): Promise<string | null> {
  const email = await emailOf(userId);
  if (!email || isAdminEmail(email)) return null;
  if (suspension) {
    await sql()`
      update users set banned = true, ban_reason = ${suspension.reason},
        ban_expires = ${suspension.expires ? suspension.expires.toISOString() : null}
      where id = ${userId}
    `;
    await sql()`delete from sessions where user_id = ${userId}`;
  } else {
    await sql()`update users set banned = false, ban_reason = null, ban_expires = null where id = ${userId}`;
  }
  return email;
}

/** Only the known limit keys, each a positive whole number. Empty means the defaults. */
export async function setLimits(userId: string, raw: Record<string, unknown>) {
  const limits: Record<string, number> = {};
  for (const key of LIMIT_KEYS) {
    const value = Number(raw[key]);
    if (Number.isFinite(value) && value > 0) limits[key] = Math.floor(value);
  }
  await sql()`update users set limits = ${JSON.stringify(limits)}::jsonb where id = ${userId}`;
  return limits;
}

/** Refuses an admin address whoever calls it (§2.2). Returns the deleted email, or null. */
export async function deleteAccountById(userId: string): Promise<string | null> {
  const email = await emailOf(userId);
  if (!email || isAdminEmail(email)) return null;
  await sql()`delete from users where id = ${userId}`;
  return email;
}
