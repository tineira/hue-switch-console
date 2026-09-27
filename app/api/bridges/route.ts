import { getSessionUser } from "@/lib/auth";
import { listBridges } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { databaseError, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    const bridges = await listBridges(user.id);
    return jsonOk({
      bridges: bridges.map((row) => ({
        bridgeid: row.bridgeid,
        bridge_ip: row.bridge_ip,
        updated_at: row.updated_at,
        snapshot: row.snapshot,
      })),
    });
  } catch (err) {
    return databaseError(err);
  }
}
