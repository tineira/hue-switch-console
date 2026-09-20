import { getSwitchByMac, listRecipes, touchSwitch } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }

  let device;
  try {
    device = await authenticateDevice(req);
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
  if (!device) return jsonError(401, "unauthorized");

  const url = new URL(req.url);
  const mac = normalizeMac(url.searchParams.get("mac") ?? "");
  if (!mac) return jsonError(400, "mac query parameter is required");

  try {
    const sw = await getSwitchByMac(device.userId, mac);
    if (!sw) return jsonError(404, "not_found");
    await touchSwitch(sw.id);
    const recipes = await listRecipes(sw.id);
    return jsonOk({ rev: sw.rev, recipes });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
