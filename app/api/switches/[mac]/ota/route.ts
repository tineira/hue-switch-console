import { getSessionUser } from "@/lib/auth";
import { EDITING_WINDOW_MIN } from "@/lib/config-sync";
import { getSwitchByMac, markSwitchEditing, setOtaOffer, toSwitchPublic } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { currentVersion } from "@/lib/firmware";
import { databaseError, jsonError, jsonOk } from "@/lib/http";
import { otaCapable, otaStatus } from "@/lib/ota";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function withSwitch(
  context: { params: Promise<{ mac: string }> },
  run: (userId: string, sw: NonNullable<Awaited<ReturnType<typeof getSwitchByMac>>>) => Promise<Response>,
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");
  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    return await run(user.id, sw);
  } catch (err) {
    return databaseError(err);
  }
}

async function reply(userId: string, mac: string, latest: string) {
  const sw = await getSwitchByMac(userId, mac);
  if (!sw) return jsonError(404, "not_found");
  return jsonOk({
    ok: true,
    ...toSwitchPublic(sw),
    latest_firmware: latest || null,
    ota_status: otaStatus(sw, latest),
  });
}

/**
 * Offers the product's current release to this switch; its next poll carries `ota`
 * (docs/specs/finished/ota.md §2.4). A switch ahead of the release gets a downgrade.
 */
export async function POST(_req: Request, context: { params: Promise<{ mac: string }> }) {
  return withSwitch(context, async (userId, sw) => {
    if (!otaCapable(sw)) {
      return jsonError(409, "not_ota_capable", {
        details: "This switch cannot update over Wi-Fi. Update it over USB from Setup.",
      });
    }
    const latest = await currentVersion(sw.product);
    if (!latest) {
      return jsonError(409, "no_release", { details: "No firmware release is published yet." });
    }
    if (latest === sw.firmware) {
      return jsonError(409, "already_current", { details: `This switch already runs ${latest}.` });
    }
    await setOtaOffer(userId, [sw.id], true);
    await markSwitchEditing(sw.id, EDITING_WINDOW_MIN);
    return reply(userId, sw.mac, latest);
  });
}

/** Cancels the offer: the next poll no longer carries `ota`. */
export async function DELETE(_req: Request, context: { params: Promise<{ mac: string }> }) {
  return withSwitch(context, async (userId, sw) => {
    await setOtaOffer(userId, [sw.id], false);
    return reply(userId, sw.mac, (await currentVersion(sw.product)) ?? "");
  });
}
