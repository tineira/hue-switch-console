import { Resend } from "resend";
import { emailDailyCap, envValue, isEmailConfigured } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// Every message counts toward EMAIL_DAILY_CAP (Resend's free tier is 100 a day). Codes are
// logged as code_sent, which the per-address and per-IP limits count (lib/auth-limits.ts);
// invites and notices as email_sent, so they don't use up an address's code requests.

type SentKind = "code_sent" | "email_sent";

export async function emailsSentToday(): Promise<number> {
  const rows = await sql()`
    select count(*)::int as n from auth_events
    where kind in ('email_sent', 'code_sent') and created_at > now() - interval '24 hours'
  `;
  return (rows[0] as { n: number }).n;
}

export async function emailCapReached(): Promise<boolean> {
  return (await emailsSentToday()) >= emailDailyCap();
}

async function send(
  to: string,
  subject: string,
  text: string,
  ip?: string | null,
  kind: SentKind = "email_sent",
) {
  if (!isEmailConfigured()) throw new Error("Email is not configured");
  if (process.env.EMAIL_DEV_CONSOLE === "1" && process.env.NODE_ENV !== "production") {
    // Local development: print instead of sending.
    console.log(`[email] to=${to} subject=${subject}\n${text}`);
    await sql()`insert into auth_events (kind, email, ip) values (${kind}, ${to}, ${ip ?? null})`;
    return;
  }
  const resend = new Resend(envValue("RESEND_API_KEY"));
  const { error } = await resend.emails.send({
    from: envValue("EMAIL_FROM")!,
    to,
    subject,
    text,
  });
  if (error) throw new Error(`Email not sent: ${error.message}`);
  await sql()`
    insert into auth_events (kind, email, ip) values (${kind}, ${to}, ${ip ?? null})
  `;
}

const SIGN_OFF = "\n\nIf you didn't ask for this, you can ignore this email.\n\nHue Switch Console";

export async function sendSignInCode(to: string, code: string, ip?: string | null) {
  await send(
    to,
    `${code} is your Hue Switch Console code`,
    `Your sign-in code is ${code}\n\nIt expires in 10 minutes.${SIGN_OFF}`,
    ip,
    "code_sent",
  );
}

export async function sendChangeEmailCode(to: string, code: string, ip?: string | null) {
  await send(
    to,
    `${code} confirms your new email`,
    `Enter ${code} in the console to use this address for your Hue Switch Console account.\n\nIt expires in 10 minutes.${SIGN_OFF}`,
    ip,
    "code_sent",
  );
}

export async function sendEmailChangedNotice(to: string, newEmail: string) {
  await send(
    to,
    "Your Hue Switch Console email was changed",
    `Your account now signs in with ${newEmail}, and other sessions were signed out.\n\nIf you didn't make this change, contact whoever runs this console.\n\nHue Switch Console`,
  );
}

/** `requested`: the person asked for it on /login; otherwise the admin invited them directly. */
export async function sendInvite(to: string, link: string, requested = true) {
  const opening = requested
    ? "You asked for an invite, and a spot is open."
    : "You're invited to Hue Switch Console, where you set up Wi-Fi wall switches for Philips Hue.";
  await send(
    to,
    "Your invite to Hue Switch Console",
    `${opening}\n\nCreate your account here (the link works once and expires in 14 days):\n${link}\n\nSign in with Google, GitHub, or a code sent to this address.\n\nHue Switch Console`,
  );
}
