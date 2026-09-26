import { sql } from "@/lib/sql";

// Sign-in rate limits kept in auth_events (docs/specs/multi-user-accounts.md §2.5).

type Kind = "email_sent" | "code_failed" | "invite_requested";

async function count(kind: Kind, where: { email?: string; ip?: string }, minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const rows = where.email
    ? await sql()`select count(*)::int as n from auth_events
        where kind = ${kind} and email = ${where.email} and created_at > ${since}`
    : where.ip
      ? await sql()`select count(*)::int as n from auth_events
          where kind = ${kind} and ip = ${where.ip} and created_at > ${since}`
      : await sql()`select count(*)::int as n from auth_events
          where kind = ${kind} and created_at > ${since}`;
  return (rows[0] as { n: number }).n;
}

export async function codeSendAllowed(email: string, ip: string | null): Promise<boolean> {
  if ((await count("email_sent", { email }, 15)) >= 3) return false;
  if (ip && (await count("email_sent", { ip }, 60)) >= 10) return false;
  return true;
}

export async function codeCheckAllowed(ip: string | null): Promise<boolean> {
  if (!ip) return true;
  return (await count("code_failed", { ip }, 60)) < 30;
}

export async function recordCodeFailed(email: string, ip: string | null) {
  await sql()`insert into auth_events (kind, email, ip) values ('code_failed', ${email}, ${ip})`;
}

export async function inviteRequestAllowed(ip: string | null): Promise<boolean> {
  if (ip && (await count("invite_requested", { ip }, 60)) >= 3) return false;
  return (await count("invite_requested", {}, 24 * 60)) < 50;
}

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || null;
  return headers.get("x-real-ip");
}
