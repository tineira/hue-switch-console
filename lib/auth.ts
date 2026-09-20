import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email?: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (typeof sub !== "string" || !sub) return null;
  const email =
    typeof data.claims?.email === "string" ? data.claims.email : undefined;
  return { id: sub, email };
}

export async function requireSessionUser(): Promise<SessionUser> {
  if (!isSupabaseConfigured()) redirect("/login");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function ensureSeedUser(): Promise<{
  created: boolean;
  error?: string;
}> {
  const email = process.env.USER_EMAIL?.trim();
  const password = process.env.USER_PASSWORD;
  if (!email || !password) {
    return { created: false, error: "USER_EMAIL and USER_PASSWORD are not set" };
  }
  if (!isSupabaseConfigured()) {
    return { created: false, error: "Supabase is not configured" };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return { created: true };
  const already =
    error.message.toLowerCase().includes("already") ||
    error.message.toLowerCase().includes("registered") ||
    error.message.toLowerCase().includes("exists");
  if (already) return { created: false };
  return { created: false, error: error.message };
}
