import { sql } from "@/lib/sql";

// /admin queries (docs/specs/finished/multi-user-accounts.md §2.7). Counts only: no recipes or topology.

export type AdminAccountRow = {
  id: string;
  email: string;
  methods: string[];
  created_at: string;
  last_login_at: string | null;
  switches: number;
  bridges: number;
  last_board_seen: string | null;
  banned: boolean;
  limits: Record<string, number>;
  dormant: boolean;
};

export const SORTS = {
  email: "email",
  created: "created_at",
  login: "last_login_at",
  switches: "switches",
  bridges: "bridges",
  seen: "last_board_seen",
  status: "banned",
} as const;

export type SortKey = keyof typeof SORTS;

export async function listAccounts(): Promise<AdminAccountRow[]> {
  const rows = await sql()`
    select u.id, u.email, u.created_at, u.last_login_at, u.banned, u.limits,
      coalesce((select array_agg(a.provider_id order by a.provider_id) from accounts a where a.user_id = u.id), '{}') as methods,
      (select count(*)::int from switches s where s.user_id = u.id) as switches,
      (select count(*)::int from bridges b where b.user_id = u.id) as bridges,
      (select max(s.last_seen_at) from switches s where s.user_id = u.id) as last_board_seen
    from users u
    order by u.created_at desc
    limit 1000
  `;
  const dormantBefore = Date.now() - 60 * 24 * 60 * 60 * 1000;
  return (rows as Record<string, unknown>[]).map((r) => {
    const lastLogin = r.last_login_at ? new Date(r.last_login_at as string).getTime() : null;
    const created = new Date(r.created_at as string).getTime();
    const switches = Number(r.switches);
    return {
      id: String(r.id),
      email: String(r.email),
      methods: (r.methods as string[]) ?? [],
      created_at: new Date(r.created_at as string).toISOString(),
      last_login_at: r.last_login_at ? new Date(r.last_login_at as string).toISOString() : null,
      switches,
      bridges: Number(r.bridges),
      last_board_seen: r.last_board_seen ? new Date(r.last_board_seen as string).toISOString() : null,
      banned: Boolean(r.banned),
      limits: (r.limits as Record<string, number>) ?? {},
      // No switch and no sign-in for 60 days (§2.8).
      dormant: switches === 0 && (lastLogin ?? created) < dormantBefore,
    };
  });
}

export async function setBanned(userId: string, banned: boolean) {
  await sql()`
    update users set banned = ${banned}, ban_reason = ${banned ? "Suspended by admin" : null}
    where id = ${userId}
  `;
  if (banned) await sql()`delete from sessions where user_id = ${userId}`;
}

export async function setLimits(userId: string, limits: Record<string, number>) {
  await sql()`update users set limits = ${JSON.stringify(limits)}::jsonb where id = ${userId}`;
}

export async function deleteAccountById(userId: string) {
  await sql()`delete from users where id = ${userId}`;
}
