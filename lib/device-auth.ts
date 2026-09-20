import { findActiveApiKeyByHash, touchApiKey } from "@/lib/db";
import { bearerToken } from "@/lib/http";
import { hashDeviceToken } from "@/lib/tokens";

export type DeviceAuth = {
  keyId: string;
  userId: string;
  name: string;
};

export async function authenticateDevice(
  req: Request,
): Promise<DeviceAuth | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const row = await findActiveApiKeyByHash(hashDeviceToken(token));
  if (!row) return null;
  await touchApiKey(row.id);
  return { keyId: row.id, userId: row.user_id, name: row.name };
}
