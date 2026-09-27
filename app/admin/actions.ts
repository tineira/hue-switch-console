"use server";

import { revalidatePath } from "next/cache";
import { signupMode } from "@/lib/account-config";
import { deleteAccountById, setBanned, setLimits } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/lib/console-settings";
import { sendInvite } from "@/lib/email";
import { siteOrigin as origin } from "@/lib/origin";
import {
  createInvite,
  getInvite,
  INVITE_DAYS,
  isValidEmail,
  normalizeEmail,
  revokeInvite,
} from "@/lib/signup";
import { admitEntry, admitQuietly, dismissEntry } from "@/lib/waitlist";

export type InviteState = { link?: string; error?: string } | undefined;

export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const raw = String(formData.get("email") ?? "").trim();
  const email = raw ? normalizeEmail(raw) : null;
  if (email && !isValidEmail(email)) return { error: "Enter a valid email or leave it empty." };
  const { code } = await createInvite({ email, createdBy: admin.id });
  revalidatePath("/admin");
  return { link: `${await origin()}/login?invite=${code}` };
}

export async function revokeInviteAction(formData: FormData) {
  await requireAdmin();
  await revokeInvite(String(formData.get("id")));
  revalidatePath("/admin");
}

/**
 * Emails an open invite that is tied to an address. Only a hash of the old link is stored, so
 * a new invite is created and sent, and the old one revoked once the email is out.
 */
export async function emailInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const old = await getInvite(String(formData.get("id")));
  if (!old?.email || old.used_at || old.revoked_at) return;
  if (new Date(old.expires_at).getTime() < Date.now()) return;
  const { id, code } = await createInvite({ email: old.email, createdBy: admin.id });
  try {
    await sendInvite(old.email, `${await origin()}/login?invite=${code}`, {
      waitlist: false,
      days: INVITE_DAYS,
    });
  } catch (err) {
    await revokeInvite(id);
    throw err;
  }
  await revokeInvite(old.id);
  revalidatePath("/admin");
}

/** Admit now (works even when the console is full) or remove a waitlist entry (§2.3, §2.7). */
export async function decideRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (formData.get("decision") === "approve") {
    await admitEntry(id, admin.id, await origin());
  } else {
    await dismissEntry(id);
  }
  revalidatePath("/admin");
}

export type WaitlistSettingsState = { error?: string; saved?: boolean } | undefined;

/** Mode (invite or waitlist) and the seat cap. Saving runs admission for any new seats. */
export async function waitlistSettingsAction(
  _prev: WaitlistSettingsState,
  formData: FormData,
): Promise<WaitlistSettingsState> {
  await requireAdmin();
  const env = signupMode();
  if (env !== "invite" && env !== "waitlist") {
    return { error: `SIGNUP_MODE is ${env}; the waitlist settings apply only to invite or waitlist.` };
  }
  const mode = formData.get("mode") === "waitlist" ? "waitlist" : "invite";
  const raw = String(formData.get("cap") ?? "").trim();
  const cap = raw === "" ? null : Number(raw);
  if (cap !== null && (!Number.isInteger(cap) || cap < 0)) {
    return { error: "The cap is a whole number, 0 or more. Leave it empty for no cap." };
  }
  await saveSettings({ signupMode: mode, userCap: cap });
  await admitQuietly(await origin());
  revalidatePath("/admin");
  return { saved: true };
}

export async function suspendAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) return;
  await setBanned(id, formData.get("banned") === "true");
  revalidatePath("/admin");
}

export async function deleteAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const email = String(formData.get("email") ?? "");
  const typed = normalizeEmail(String(formData.get("confirm") ?? ""));
  if (id === admin.id || !email || typed !== email) return;
  await deleteAccountById(id);
  // The seat is free: offer it to the next person waiting.
  await admitQuietly(await origin());
  revalidatePath("/admin");
}

export async function limitsAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const limits: Record<string, number> = {};
  for (const key of ["switches", "bridges", "keys", "snapshotKb"]) {
    const value = Number(formData.get(key));
    if (Number.isFinite(value) && value > 0) limits[key] = Math.floor(value);
  }
  await setLimits(id, limits);
  revalidatePath("/admin");
}
