import { getSessionUser } from "@/lib/auth";
import { latestFirmware } from "@/lib/bridge-switches";
import { configStatus } from "@/lib/config-sync";
import {
  getSwitchByMac,
  isApiKeyRevoked,
  removeSwitch,
  toSwitchPublic,
  updateSwitchLabel,
} from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { databaseError, jsonError, jsonOk } from "@/lib/http";
import { otaCapable, otaStatus } from "@/lib/ota";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const LABEL_MAX = 80;

export async function GET(
  _req: Request,
  context: { params: Promise<{ mac: string }> },
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
    if (!sw) return jsonOk({ found: false });
    const latest = (await latestFirmware())[sw.product];
    return jsonOk({
      found: true,
      last_seen_at: sw.last_seen_at,
      firmware: sw.firmware,
      label: sw.label,
      key_revoked: sw.api_key_id ? await isApiKeyRevoked(sw.api_key_id) : false,
      applied_rev: sw.applied_rev,
      config_status: configStatus(sw),
      next_poll_at: sw.next_poll_at,
      firmware_seen_at: sw.firmware_seen_at,
      latest_firmware: latest || null,
      ota_capable: otaCapable(sw),
      ota_status: otaStatus(sw, latest),
      ota_offered_at: sw.ota_offered_at,
      ota_error: sw.ota_error,
    });
  } catch (err) {
    return databaseError(err);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  if (!body || typeof body !== "object" || !("label" in body)) {
    return jsonError(400, "label is required");
  }
  const raw = (body as { label: unknown }).label;
  let label: string | null = null;
  if (raw !== null) {
    if (typeof raw !== "string") {
      return jsonError(400, "label must be a string or null");
    }
    const trimmed = raw.trim();
    if (trimmed.length > LABEL_MAX) {
      return jsonError(400, `label must be at most ${LABEL_MAX} characters`);
    }
    label = trimmed.length ? trimmed : null;
  }

  try {
    const existing = await getSwitchByMac(user.id, mac);
    if (!existing) return jsonError(404, "not_found");
    const sw = await updateSwitchLabel(user.id, mac, label);
    if (!sw) return jsonError(404, "not_found");
    return jsonOk({ ok: true, ...toSwitchPublic(sw) });
  } catch (err) {
    return databaseError(err);
  }
}

/** Removes the switch and, unless another switch shares it, revokes its key (docs/device-api.md). */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ mac: string }> },
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
    const result = await removeSwitch(user.id, mac);
    if (!result.removed) return jsonError(404, "not_found");
    return jsonOk({ removed: true, key_revoked: result.keyRevoked });
  } catch (err) {
    return databaseError(err);
  }
}
