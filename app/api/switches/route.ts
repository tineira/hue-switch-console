import { getSessionUser } from "@/lib/auth";
import { listSwitches, toSwitchPublic } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    const switches = await listSwitches(user.id);
    return jsonOk({ switches: switches.map(toSwitchPublic) });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
