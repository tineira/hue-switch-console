import { getSessionUser } from "@/lib/auth";
import { getBridge, removeBridge } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { databaseError, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ bridgeid: string }> },
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
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
    return databaseError(err);
  }
}

/** Removes a Bridge that no switch of the account is on; `409 bridge_has_switches` otherwise. */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ bridgeid: string }> },
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { bridgeid } = await context.params;
  try {
    const result = await removeBridge(user.id, bridgeid);
    if (result === "not_found") return jsonError(404, "not_found");
    if (result === "has_switches") return jsonError(409, "bridge_has_switches");
    return jsonOk({ removed: true });
  } catch (err) {
    return databaseError(err);
  }
}
