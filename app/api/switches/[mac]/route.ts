import { getSessionUser } from "@/lib/auth";
import {
  getSwitchByMac,
  isApiKeyRevoked,
  toSwitchPublic,
  updateSwitchLabel,
} from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
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
    return jsonOk({
      found: true,
      last_seen_at: sw.last_seen_at,
      firmware: sw.firmware,
      key_revoked: sw.api_key_id ? await isApiKeyRevoked(sw.api_key_id) : false,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
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
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
