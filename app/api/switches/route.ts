import { getSessionUser } from "@/lib/auth";
import { latestFirmware } from "@/lib/bridge-switches";
import { listSwitches, toSwitchPublic } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { databaseError, jsonError, jsonOk } from "@/lib/http";
import { otaStatus } from "@/lib/ota";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    const [switches, latest] = await Promise.all([listSwitches(user.id), latestFirmware()]);
    return jsonOk({
      switches: switches.map((sw) => ({
        ...toSwitchPublic(sw),
        latest_firmware: latest[sw.product] || null,
        ota_status: otaStatus(sw, latest[sw.product]),
      })),
    });
  } catch (err) {
    return databaseError(err);
  }
}
