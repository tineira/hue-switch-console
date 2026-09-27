import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

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

// Compares a presented secret with the configured one without leaking timing.
export function secretMatches(token: string | null, expected: string): boolean {
  if (!token) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
