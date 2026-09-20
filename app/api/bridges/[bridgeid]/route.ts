import { getSessionUser } from "@/lib/auth";
import { getBridge } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ bridgeid: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { bridgeid } = await context.params;
  try {
    const row = await getBridge(user.id, bridgeid);
    if (!row) return jsonError(404, "not_found");
    return jsonOk({
      bridgeid: row.bridgeid,
      bridge_ip: row.bridge_ip,
      updated_at: row.updated_at,
      snapshot: row.snapshot,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
