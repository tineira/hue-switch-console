import { findActiveApiKeyByHash, touchApiKey } from "@/lib/db";
import { bearerToken } from "@/lib/http";
import { isSuspended } from "@/lib/suspension";
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
  const suspended = await isSuspended(row.user_id);
  return { keyId: row.id, userId: row.user_id, name: row.name, suspended };
}
