import { Resend } from "resend";
import { envValue, isEmailConfigured } from "@/lib/account-config";
import type { EmailTag } from "@/lib/email";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { normalizeEmail } from "@/lib/signup";
import { admitQuietly, markUndeliverable } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const TAGS = new Set<EmailTag>(["code", "invite", "waitlist", "notice", "alert"]);

// Bounces and complaints from Resend (docs/specs/waitlist.md §2.5). Subscribed events:
// email.bounced, email.complained, email.suppressed. Everything else is acknowledged and ignored.
export async function POST(req: Request) {
  const secret = envValue("RESEND_WEBHOOK_SECRET");
  if (!secret || !isEmailConfigured()) return jsonError(503, "webhook_not_configured");
  if (!isDbConfigured()) return jsonError(503, "database_not_configured");

  // The signature covers the raw body, so read it as text before parsing anything.
  const payload = await req.text();
  let event;
  try {
    event = new Resend(envValue("RESEND_API_KEY")).webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return jsonError(400, "invalid_signature");
  }

  if (
    event.type !== "email.bounced" &&
    event.type !== "email.suppressed" &&
    event.type !== "email.complained"
  ) {
    return jsonOk({ ok: true, ignored: event.type });
  }
  // Only permanent bounces count; temporary ones (full mailbox, server busy) clear up by
  // themselves. A suppressed send means Resend refused an address that bounced before.
  if (event.type === "email.bounced" && event.data.bounce?.type !== "Permanent") {
    return jsonOk({ ok: true, ignored: "transient_bounce" });
  }
  const kind = event.type === "email.complained" ? "complained" : "bounced";
  const data = event.data;

  await ensureSchema();
  const rawTag = data.tags?.kind as EmailTag | undefined;
  const tag = rawTag && TAGS.has(rawTag) ? rawTag : null;
  let freed = false;
  for (const to of data.to ?? []) {
    if (await markUndeliverable(normalizeEmail(to), kind, tag)) freed = true;
  }
  // A bounced waitlist invite gave its seat back: offer it to the next person.
  if (freed) await admitQuietly();
  return jsonOk({ ok: true, kind });
}
