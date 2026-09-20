import { createHash, randomBytes } from "node:crypto";

export { formatMac, normalizeMac } from "@/lib/mac";

export function generateDeviceToken(): {
  token: string;
  prefix: string;
  hash: string;
} {
  const token = `hsw_${randomBytes(24).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), hash: hashDeviceToken(token) };
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}


