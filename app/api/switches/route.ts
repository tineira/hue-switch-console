import { getSessionUser } from "@/lib/auth";
import { listSwitches, toSwitchPublic } from "@/lib/db";
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
    const switches = await listSwitches(user.id);
    return jsonOk({ switches: switches.map(toSwitchPublic) });
  } catch (err) {
    return databaseError(err);
  }
}
