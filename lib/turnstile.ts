import { envValue } from "@/lib/account-config";

// Cloudflare Turnstile server check. Passes when Turnstile is not configured.

export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = envValue("TURNSTILE_SECRET_KEY");
  if (!secret || !envValue("TURNSTILE_SITE_KEY")) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
