"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEmailConfigured } from "@/lib/account-config";
import { clientIp, codeSendAllowed } from "@/lib/auth-limits";
import { requireSessionUser } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { emailCapReached, sendEmailChangedNotice } from "@/lib/email";
import { isValidEmail, normalizeEmail } from "@/lib/signup";
import { sql } from "@/lib/sql";
import { admitQuietly } from "@/lib/waitlist";

// /account (docs/specs/finished/multi-user-accounts.md §2.6).

export type ChangeEmailState =
  | { step: "email"; error?: string }
  | { step: "code"; newEmail: string; error?: string }
  | { step: "done"; newEmail: string };

export async function changeEmail(
  prev: ChangeEmailState,
  formData: FormData,
): Promise<ChangeEmailState> {
  const user = await requireSessionUser();
  if (!isEmailConfigured()) return { step: "email", error: "Email is not set up on this console." };
  const h = await headers();

  if (formData.get("intent") === "verify") {
    const newEmail = normalizeEmail(String(formData.get("newEmail") ?? ""));
    const otp = String(formData.get("code") ?? "").replace(/\s+/g, "");
    try {
      await auth().api.changeEmailEmailOTP({ body: { newEmail, otp }, headers: h });
    } catch (err) {
      const message = (err as { body?: { message?: string } })?.body?.message;
      return {
        step: "code",
        newEmail,
        error: message === "Email already in use" ? message : "That code is wrong or has expired.",
      };
    }
    // Other sessions end; the old address hears about it.
    await auth().api.revokeOtherSessions({ headers: h }).catch(() => {});
    if (user.email) await sendEmailChangedNotice(user.email, newEmail).catch(() => {});
    return { step: "done", newEmail };
  }

  const newEmail = normalizeEmail(String(formData.get("newEmail") ?? ""));
  if (!isValidEmail(newEmail)) return { step: "email", error: "Enter a valid email address." };
  if (newEmail === user.email) return { step: "email", error: "That is already your email." };
  if (await emailCapReached()) return { step: "email", error: "Email is busy right now. Try again later." };
  if (!(await codeSendAllowed(newEmail, clientIp(h)))) {
    return { step: "email", error: "Too many codes requested. Wait a few minutes and try again." };
  }
  try {
    await auth().api.requestEmailChangeEmailOTP({ body: { newEmail }, headers: h });
  } catch {
    return {
      step: "email",
      error: "Couldn't start the change. Sign out and in again, then retry.",
    };
  }
  void prev;
  return { step: "code", newEmail };
}

export async function signOutEverywhere() {
  await requireSessionUser();
  await auth().api.revokeSessions({ headers: await headers() }).catch(() => {});
  redirect("/login");
}

export async function deleteAccount(_prev: { error?: string } | undefined, formData: FormData) {
  const user = await requireSessionUser();
  const typed = normalizeEmail(String(formData.get("confirm") ?? ""));
  if (!user.email || typed !== user.email) {
    return { error: "Type your email exactly to confirm." };
  }
  await auth().api.signOut({ headers: await headers() }).catch(() => {});
  // Cascades to sessions, sign-in methods, keys, bridges, switches, pages and recipes.
  await sql()`delete from users where id = ${user.id}`;
  // The seat is free: offer it to the next person waiting (docs/specs/waitlist.md §2.3).
  await admitQuietly();
  redirect("/login");
}
