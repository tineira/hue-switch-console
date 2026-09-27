import { sql } from "@/lib/sql";

// A suspension counts while it has no end date or the end date is still ahead
// (docs/specs/admin-tools.md §2.6). The daily cron clears expired ones.

type BanRow = { banned?: boolean | null; ban_expires?: string | Date | null };

export function isSuspendedRow(row: BanRow | undefined): boolean {
  if (!row?.banned) return false;
  return !row.ban_expires || new Date(row.ban_expires).getTime() > Date.now();
}

export async function isSuspended(userId: string): Promise<boolean> {
  const rows = await sql()`select banned, ban_expires from users where id = ${userId}`;
  return isSuspendedRow(rows[0] as BanRow | undefined);
}
