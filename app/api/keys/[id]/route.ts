import { getSessionUser } from "@/lib/auth";
import { revokeApiKey } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { id } = await context.params;
  try {
    const ok = await revokeApiKey(user.id, id);
    if (!ok) return jsonError(404, "not_found");
    return jsonOk({ ok: true });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
