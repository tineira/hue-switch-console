import { getSessionUser } from "@/lib/auth";
import { listSwitches, setOtaOffer } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { currentVersion } from "@/lib/firmware";
import { databaseError, jsonError, jsonOk } from "@/lib/http";
import { otaCapable, otaStatus } from "@/lib/ota";

export const dynamic = "force-dynamic";

/**
 * Offers the current release to every switch on this Bridge that can update over
 * Wi-Fi and is behind. Never a downgrade (docs/specs/finished/ota.md §2.4, §3.2).
 */
export async function POST(
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
    const onBridge = (await listSwitches(user.id)).filter((sw) => sw.bridgeid === bridgeid);
    const [round, simple] = await Promise.all([currentVersion("round"), currentVersion("simple")]);
    const latest = { round: round ?? "", simple: simple ?? "" };
    const behind = onBridge.filter(
      (sw) => otaCapable(sw) && otaStatus(sw, latest[sw.product]) === "behind",
    );
    await setOtaOffer(user.id, behind.map((sw) => sw.id), true);
    return jsonOk({ offered: behind.map((sw) => sw.mac) });
  } catch (err) {
    return databaseError(err);
  }
}
