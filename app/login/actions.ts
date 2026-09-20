"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  ensureSeedUser,
  signInWithPassword,
} from "@/lib/auth";
import { isDbConfigured } from "@/lib/env";

export type LoginState = { error: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isDbConfigured()) {
    return { error: "Database is not configured." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  await ensureSeedUser();
  const ok = await signInWithPassword(email, password);
  if (!ok) {
    return { error: "Invalid email or password." };
  }
  redirect("/");
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/login");
}
