"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/return-path";
import { recordAcceptance } from "@/lib/terms";

// /accept (docs/specs/terms-and-safety.md §2.4).
export async function acceptTerms(_prev: { error?: string } | undefined, formData: FormData) {
  const user = await getSessionUser({ allowPending: true });
  if (!user) redirect("/login");
  // Every pending document needs its own ticked box; the button being enabled proves nothing.
  const missing = user.pending.filter((d) => formData.get(d) !== "on");
  if (missing.length > 0) return { error: "Tick every box to continue." };
  await recordAcceptance(user.id, user.pending);
  redirect(safeReturnPath(String(formData.get("next") ?? "")));
}
