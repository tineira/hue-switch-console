"use server";

import { revalidatePath } from "next/cache";
import { publicUrl } from "@/lib/account-config";
import { deleteAccountById, setBanned, setLimits } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { sendInvite } from "@/lib/email";
import { headers } from "next/headers";
import {
  createInvite,
  decideInviteRequest,
  getInvite,
  getInviteRequest,
  isValidEmail,
  normalizeEmail,
  revokeInvite,
} from "@/lib/signup";

async function origin(): Promise<string> {
  const configured = publicUrl();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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
    await sendInvite(old.email, `${await origin()}/login?invite=${code}`, false);
  } catch (err) {
    await revokeInvite(id);
    throw err;
  }
  await revokeInvite(old.id);
  revalidatePath("/admin");
}

export async function decideRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const request = await getInviteRequest(id);
  if (!request || request.status !== "pending") return;
  if (formData.get("decision") === "approve") {
    const { id: inviteId, code } = await createInvite({ email: request.email, createdBy: admin.id });
    await sendInvite(request.email, `${await origin()}/login?invite=${code}`);
    await decideInviteRequest(id, "approved", inviteId);
  } else {
    await decideInviteRequest(id, "dismissed", null);
  }
  revalidatePath("/admin");
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
