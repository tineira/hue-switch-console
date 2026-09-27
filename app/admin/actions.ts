"use server";

import { revalidatePath } from "next/cache";
import { signupMode } from "@/lib/account-config";
import { deleteAccountById, setLimits, setSuspension } from "@/lib/admin";
import { recordAdminEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/lib/console-settings";
import { sendInvite } from "@/lib/email";
import { isVersion, parseProductId, setCurrentRelease } from "@/lib/firmware";
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

// Every action records an admin event (docs/specs/finished/admin-tools.md §2.5).

export type InviteState = { link?: string; error?: string } | undefined;

export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const raw = String(formData.get("email") ?? "").trim();
  const email = raw ? normalizeEmail(raw) : null;
  if (email && !isValidEmail(email)) return { error: "Enter a valid email or leave it empty." };
  const { code } = await createInvite({ email, createdBy: admin.id });
  await recordAdminEvent({
    adminEmail: admin.email,
    action: "invite_create",
    target: email ?? code.slice(0, 8),
  });
  revalidatePath("/admin");
  return { link: `${await origin()}/login?invite=${code}` };
}

export async function revokeInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const invite = await getInvite(String(formData.get("id")));
  if (!invite) return;
  await revokeInvite(invite.id);
  await recordAdminEvent({
    adminEmail: admin.email,
    action: "invite_revoke",
    target: invite.email ?? invite.code_prefix,
  });
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
  await recordAdminEvent({ adminEmail: admin.email, action: "invite_email", target: old.email });
  revalidatePath("/admin");
}

/** Admit now (works even when the console is full) or remove a waitlist entry (§2.3, §2.7). */
export async function decideRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const email = String(formData.get("email") ?? "") || null;
  if (formData.get("decision") === "approve") {
    if (await admitEntry(id, admin.id, await origin())) {
      await recordAdminEvent({ adminEmail: admin.email, action: "waitlist_admit", target: email });
    }
  } else {
    await dismissEntry(id);
    await recordAdminEvent({ adminEmail: admin.email, action: "waitlist_remove", target: email });
  }
  revalidatePath("/admin");
}

export type WaitlistSettingsState = { error?: string; saved?: boolean } | undefined;

/** Mode (invite or waitlist) and the seat cap. Saving runs admission for any new seats. */
export async function waitlistSettingsAction(
  _prev: WaitlistSettingsState,
  formData: FormData,
): Promise<WaitlistSettingsState> {
  const admin = await requireAdmin();
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
  await recordAdminEvent({ adminEmail: admin.email, action: "settings", details: { mode, cap } });
  await admitQuietly(await origin());
  revalidatePath("/admin");
  return { saved: true };
}

export type SuspendState = { error?: string } | undefined;

/** Suspend with an optional reason and end date, or lift a suspension (admin-tools §2.6). */
export async function suspendAction(_prev: SuspendState, formData: FormData): Promise<SuspendState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) return { error: "You can't suspend yourself." };
  if (formData.get("suspend") !== "true") {
    const email = await setSuspension(id, null);
    if (email) {
      await recordAdminEvent({ adminEmail: admin.email, action: "unsuspend", targetUserId: id, target: email });
    }
    revalidatePath("/admin");
    return undefined;
  }
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || null;
  const until = String(formData.get("until") ?? "").trim();
  let expires: Date | null = null;
  if (until) {
    // The end of that day, UTC: "until the 3rd" includes the 3rd.
    expires = new Date(`${until}T23:59:59Z`);
    if (Number.isNaN(expires.getTime())) return { error: "Pick a valid end date." };
    if (expires.getTime() <= Date.now()) return { error: "The end date must be in the future." };
  }
  const email = await setSuspension(id, { reason, expires });
  if (!email) return { error: "Admin accounts can't be suspended." };
  await recordAdminEvent({
    adminEmail: admin.email,
    action: "suspend",
    targetUserId: id,
    target: email,
    details: { reason, until: expires ? expires.toISOString() : null },
  });
  revalidatePath("/admin");
  return undefined;
}

export async function deleteAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const email = String(formData.get("email") ?? "");
  const typed = normalizeEmail(String(formData.get("confirm") ?? ""));
  if (id === admin.id || !email || typed !== email) return;
  const deleted = await deleteAccountById(id);
  if (!deleted) return;
  await recordAdminEvent({ adminEmail: admin.email, action: "delete_account", target: deleted });
  // The seat is free: offer it to the next person waiting.
  await admitQuietly(await origin());
  revalidatePath("/admin");
}

export async function limitsAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const limits = await setLimits(id, Object.fromEntries(formData));
  await recordAdminEvent({
    adminEmail: admin.email,
    action: "limits",
    targetUserId: id,
    target: String(formData.get("email") ?? "") || null,
    details: limits,
  });
  revalidatePath("/admin");
}

/** Roll the installer back or forward to a stored release (admin-tools §2.4). */
export async function makeCurrentAction(formData: FormData) {
  const admin = await requireAdmin();
  const product = parseProductId(String(formData.get("product") ?? ""));
  const version = String(formData.get("version") ?? "");
  if (!product || !isVersion(version)) return;
  if (!(await setCurrentRelease(product, version))) return;
  await recordAdminEvent({
    adminEmail: admin.email,
    action: "firmware_current",
    target: `${product} ${version}`,
  });
  revalidatePath("/admin");
}
