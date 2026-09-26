import { findActiveApiKeyByHash, touchApiKey } from "@/lib/db";
import { bearerToken } from "@/lib/http";
import { sql } from "@/lib/sql";
import { hashDeviceToken } from "@/lib/tokens";

export type DeviceAuth = {
  keyId: string;
  userId: string;
  name: string;
  /** The key's owner is suspended: routes answer 403 account_suspended. */
  suspended: boolean;
};

export async function authenticateDevice(
  req: Request,
): Promise<DeviceAuth | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const row = await findActiveApiKeyByHash(hashDeviceToken(token));
  if (!row) return null;
  await touchApiKey(row.id);
  const owner = await sql()`select banned from users where id = ${row.user_id}`;
  const suspended = Boolean((owner[0] as { banned?: boolean } | undefined)?.banned);
  return { keyId: row.id, userId: row.user_id, name: row.name, suspended };
}
