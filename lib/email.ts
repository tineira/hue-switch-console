import { Resend } from "resend";
import { emailDailyCap, isEmailConfigured } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// Every message counts toward EMAIL_DAILY_CAP (Resend's free tier is 100 a day).

export async function emailsSentToday(): Promise<number> {
  const rows = await sql()`
    select count(*)::int as n from auth_events
    where kind = 'email_sent' and created_at > now() - interval '24 hours'
  `;
  return (rows[0] as { n: number }).n;
}

export async function emailCapReached(): Promise<boolean> {
  return (await emailsSentToday()) >= emailDailyCap();
}

async function send(to: string, subject: string, text: string, ip?: string | null) {
  if (!isEmailConfigured()) throw new Error("Email is not configured");
  if (process.env.EMAIL_DEV_CONSOLE === "1" && process.env.NODE_ENV !== "production") {
    // Local development: print instead of sending.
    console.log(`[email] to=${to} subject=${subject}\n${text}`);
    await sql()`insert into auth_events (kind, email, ip) values ('email_sent', ${to}, ${ip ?? null})`;
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    text,
  });
  if (error) throw new Error(`Email not sent: ${error.message}`);
  await sql()`
    insert into auth_events (kind, email, ip) values ('email_sent', ${to}, ${ip ?? null})
  `;
}

const SIGN_OFF = "\n\nIf you didn't ask for this, you can ignore this email.\n\nHue Switch Console";

export async function sendSignInCode(to: string, code: string, ip?: string | null) {
  await send(
    to,
    `${code} is your Hue Switch Console code`,
    `Your sign-in code is ${code}\n\nIt expires in 10 minutes.${SIGN_OFF}`,
    ip,
  );
}

export async function sendChangeEmailCode(to: string, code: string, ip?: string | null) {
  await send(
    to,
    `${code} confirms your new email`,
    `Enter ${code} in the console to use this address for your Hue Switch Console account.\n\nIt expires in 10 minutes.${SIGN_OFF}`,
    ip,
  );
}

export async function sendEmailChangedNotice(to: string, newEmail: string) {
  await send(
    to,
    "Your Hue Switch Console email was changed",
    `Your account now signs in with ${newEmail}, and other sessions were signed out.\n\nIf you didn't make this change, contact whoever runs this console.\n\nHue Switch Console`,
  );
}

export async function sendInvite(to: string, link: string) {
  await send(
    to,
    "Your invite to Hue Switch Console",
    `You asked for an invite, and a spot is open.\n\nCreate your account here (the link works once and expires in 14 days):\n${link}\n\nHue Switch Console`,
  );
}
