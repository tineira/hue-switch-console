import { Resend } from "resend";
import { emailDailyCap, envValue, isEmailConfigured, waitlistEmailsPerDay } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// Every message counts toward EMAIL_DAILY_CAP (Resend's free tier is 100 a day). Codes are
// logged as code_sent, which the per-address and per-IP limits count (lib/auth-limits.ts);
// waitlist emails as waitlist_email_sent, which also have their own daily budget
// (docs/specs/waitlist.md §2.6); everything else as email_sent.

type SentKind = "code_sent" | "email_sent" | "waitlist_email_sent";

/** Resend tag on every email, so bounce and complaint events say what kind of email it was. */
export type EmailTag = "code" | "invite" | "waitlist" | "notice" | "alert";

export async function emailsSentToday(): Promise<number> {
  const rows = await sql()`
    select count(*)::int as n from auth_events
    where kind in ('email_sent', 'code_sent', 'waitlist_email_sent')
      and created_at > now() - interval '24 hours'
  `;
  return (rows[0] as { n: number }).n;
}

export async function emailCapReached(): Promise<boolean> {
  return (await emailsSentToday()) >= emailDailyCap();
}

export async function waitlistEmailsSentToday(): Promise<number> {
  const rows = await sql()`
    select count(*)::int as n from auth_events
    where kind = 'waitlist_email_sent' and created_at > now() - interval '24 hours'
  `;
  return (rows[0] as { n: number }).n;
}

/** How many more waitlist emails may go out today: the waitlist budget, within the instance cap. */
export async function waitlistEmailsLeft(): Promise<number> {
  const [all, waitlist] = await Promise.all([emailsSentToday(), waitlistEmailsSentToday()]);
  return Math.max(0, Math.min(waitlistEmailsPerDay() - waitlist, emailDailyCap() - all));
}

async function send(
  to: string,
  subject: string,
  text: string,
  tag: EmailTag,
  ip?: string | null,
  kind: SentKind = "email_sent",
) {
  if (!isEmailConfigured()) throw new Error("Email is not configured");
  if (process.env.EMAIL_DEV_CONSOLE === "1" && process.env.NODE_ENV !== "production") {
    // Local development: print instead of sending.
    console.log(`[email] to=${to} subject=${subject}
${text}`);
    await sql()`insert into auth_events (kind, email, ip) values (${kind}, ${to}, ${ip ?? null})`;
    return;
  }
  const resend = new Resend(envValue("RESEND_API_KEY"));
  const { error } = await resend.emails.send({
    from: envValue("EMAIL_FROM")!,
    to,
    subject,
    text,
    tags: [{ name: "kind", value: tag }],
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
    "code",
    ip,
    "code_sent",
  );
}

export async function sendChangeEmailCode(to: string, code: string, ip?: string | null) {
  await send(
    to,
    `${code} confirms your new email`,
    `Enter ${code} in the console to use this address for your Hue Switch Console account.\n\nIt expires in 10 minutes.${SIGN_OFF}`,
    "code",
    ip,
    "code_sent",
  );
}

export async function sendEmailChangedNotice(to: string, newEmail: string) {
  await send(
    to,
    "Your Hue Switch Console email was changed",
    `Your account now signs in with ${newEmail}, and other sessions were signed out.\n\nIf you didn't make this change, contact whoever runs this console.\n\nHue Switch Console`,
    "notice",
  );
}

const SELF_HOST = "https://github.com/tineira/hue-switch-console#accounts-and-sign-in";

/**
 * `waitlist`: the person joined the waitlist and a seat opened (automatically or by the admin);
 * otherwise the admin invited them directly.
 */
export async function sendInvite(to: string, link: string, input: { waitlist: boolean; days: number }) {
  const opening = input.waitlist
    ? "You joined the waitlist, and there is room for you now."
    : "You're invited to Hue Switch Console, where you set up Wi-Fi wall switches for Philips Hue.";
  await send(
    to,
    "Your invite to Hue Switch Console",
    `${opening}

Create your account here (the link works once and expires in ${input.days} days):
${link}

Sign in with Google, GitHub, or a code sent to this address.

Hue Switch Console`,
    "invite",
    null,
    input.waitlist ? "waitlist_email_sent" : "email_sent",
  );
}

export async function sendWaitlistConfirmation(to: string, leaveLink: string) {
  await send(
    to,
    "You're on the Hue Switch Console waitlist",
    `Thanks for joining. The hosted console runs on free servers, so we let people in in batches. We'll email you at this address when there's room for you.

Don't want to wait? The console is open source, and you can run your own:
${SELF_HOST}

To leave the waitlist:
${leaveLink}${SIGN_OFF}`,
    "waitlist",
    null,
    "waitlist_email_sent",
  );
}

export async function sendAdminAlert(to: string, subject: string, text: string) {
  await send(to, subject, `${text}

Hue Switch Console`, "alert");
}
