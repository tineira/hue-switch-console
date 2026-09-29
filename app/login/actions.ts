"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { githubConfigured, googleConfigured, isEmailConfigured } from "@/lib/account-config";
import {
  clientIp,
  codeCheckAllowed,
  codeSendAllowed,
  inviteRequestAllowed,
  recordCodeFailed,
} from "@/lib/auth-limits";
import { ensureSeedUser } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { currentSignupMode } from "@/lib/console-settings";
import { emailCapReached } from "@/lib/email";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import {
  accountStatus,
  INVITE_COOKIE,
  isDisposableEmail,
  isValidEmail,
  normalizeEmail,
  signupDecision,
} from "@/lib/signup";
import { verifyTurnstile } from "@/lib/turnstile";
import { joinWaitlist } from "@/lib/waitlist";

export type CodeState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; error?: string };

export type SimpleState = { error?: string; done?: string } | undefined;

function apiMessage(err: unknown): string | null {
  if (err && typeof err === "object") {
    const body = (err as { body?: { message?: string } }).body;
    if (body?.message) return body.message;
    const message = (err as { message?: string }).message;
    if (message) return message;
  }
  return null;
}

async function prepare(): Promise<{ ip: string | null; h: Headers }> {
  await ensureSchema();
  const h = await headers();
  return { ip: clientIp(h), h };
}

/** Step 1: email → code. The reply is the same whether or not the address can sign in. */
export async function sendCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  if (!isDbConfigured() || !isEmailConfigured()) {
    return { step: "email", error: "Email sign-in is not set up on this console." };
  }
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) return { step: "email", email, error: "Enter a valid email address." };

  const { ip, h } = await prepare();
  const token = formData.get("cf-turnstile-response");
  if (!(await verifyTurnstile(typeof token === "string" ? token : null, ip))) {
    return { step: "email", email, error: "The bot check failed. Reload the page and try again." };
  }
  if (await emailCapReached()) {
    return {
      step: "email",
      email,
      error: googleConfigured() || githubConfigured()
        ? "Email sign-in is busy. Try again later, or continue with Google or GitHub."
        : "Email sign-in is busy. Try again later.",
    };
  }
  if (!(await codeSendAllowed(email, ip))) {
    return { step: "email", email, error: "Too many codes requested. Wait a few minutes and try again." };
  }

  // A suspended account can't sign in, so no code is sent. The reply stays the same, so the
  // form never tells a stranger which addresses have (suspended) accounts.
  const status = await accountStatus(email);
  let send = status === "active";
  if (status === "none") {
    const invite = (await cookies()).get(INVITE_COOKIE)?.value;
    send = (await signupDecision(email, invite)).allowed;
  }
  if (send) {
    try {
      await auth().api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers: h });
    } catch (err) {
      console.error("sendVerificationOTP failed", err);
      return { step: "email", email, error: "The code could not be sent. Try again in a minute." };
    }
  }
  return { step: "code", email };
}

/** Step 2: email + code → signed in (and signed up, when allowed). */
export async function verifyCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const otp = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(otp)) return { step: "code", email, error: "Enter the 6-digit code." };

  const { ip, h } = await prepare();
  if (!(await codeCheckAllowed(ip))) {
    return { step: "code", email, error: "Too many attempts. Try again in an hour." };
  }
  try {
    await auth().api.signInEmailOTP({ body: { email, otp }, headers: h });
  } catch (err) {
    await recordCodeFailed(email, ip);
    const message = apiMessage(err);
    if (message && /invitation|suspended/i.test(message)) return { step: "code", email, error: message };
    return { step: "code", email, error: "That code is wrong or has expired." };
  }
  (await cookies()).delete(INVITE_COOKIE);
  redirect("/");
}

export async function signInWithProvider(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "google" && provider !== "github") redirect("/login");
  await ensureSchema();
  const res = await auth().api.signInSocial({
    body: { provider, callbackURL: "/", errorCallbackURL: "/login" },
    headers: await headers(),
  });
  if (!res?.url) redirect("/login?error=provider_unavailable");
  redirect(res.url);
}

/** Self-hosted consoles without email: the seeded account's password. */
export async function passwordLogin(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  if (!isDbConfigured()) return { error: "Database is not configured." };
  if (isEmailConfigured()) return { error: "Password sign-in is off on this console." };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  await ensureSeedUser();
  try {
    await auth().api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (err) {
    const message = apiMessage(err);
    if (message && /suspended/i.test(message)) return { error: message };
    return { error: "Invalid email or password." };
  }
  redirect("/");
}

/** "Join the waitlist" (docs/specs/finished/waitlist.md §2.4). */
export async function joinWaitlistAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const mode = await currentSignupMode();
  if (mode !== "invite" && mode !== "waitlist") return { error: "The waitlist is closed." };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };

  const { ip } = await prepare();
  const token = formData.get("cf-turnstile-response");
  if (!(await verifyTurnstile(typeof token === "string" ? token : null, ip))) {
    return { error: "The bot check failed. Reload the page and try again." };
  }
  if (isDisposableEmail(email)) return { error: "Use a permanent email address." };
  if (!(await inviteRequestAllowed(ip))) {
    return { error: "Too many requests right now. Try again later." };
  }
  if ((await joinWaitlist(email, ip)) === "undeliverable") {
    return { error: "We couldn't deliver email to this address. Check it or use another one." };
  }
  // The same reply whether the address got an invite, was queued, was already waiting, or
  // already has an account.
  return { done: "Thanks. Watch your inbox: we'll email you there." };
}

export async function signOut() {
  if (isDbConfigured()) {
    try {
      await auth().api.signOut({ headers: await headers() });
    } catch {
      // Already signed out.
    }
  }
  redirect("/");
}
