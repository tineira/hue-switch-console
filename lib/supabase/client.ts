import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseKey } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicSupabaseKey(),
  );
}
