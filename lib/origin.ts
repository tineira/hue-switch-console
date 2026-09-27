import { headers } from "next/headers";
import { publicUrl } from "@/lib/account-config";

/** The console's public origin for links in emails: BETTER_AUTH_URL, else the current request. */
export async function siteOrigin(): Promise<string> {
  const configured = publicUrl();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
