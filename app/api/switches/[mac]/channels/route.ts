import { getSessionUser } from "@/lib/auth";
import {
  getBridge,
  getSwitchByMac,
  isRoundSwitch,
  listSimpleChannels,
  replaceSimpleChannels,
  toSwitchPublic,
} from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { resolvePageGroup } from "@/lib/pages";
import { parseSimpleChannels } from "@/lib/parse";
import { snapshotFromJson } from "@/lib/recipes";
import {
  SIMPLE_MIN_FIRMWARE,
  supportsChannelTypes,
  validateSimpleChannels,
  withSnapshotNames,
} from "@/lib/simple-channels";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function prepare(context: { params: Promise<{ mac: string }> }) {
  if (!isDbConfigured()) {
    return { response: jsonError(503, "database_not_configured") };
  }
  const user = await getSessionUser();
  if (!user) return { response: jsonError(401, "unauthorized") };
  try {
    await ensureSchema();
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return { response: jsonError(500, "database_error", { details }) };
  }
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return { response: jsonError(400, "mac must be 12 hex digits") };
  return { user, mac };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  const ready = await prepare(context);
  if ("response" in ready) return ready.response;
  const { user, mac } = ready;

  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    if (isRoundSwitch(sw)) {
      return jsonError(400, "round_switch_uses_pages", {
        details: "Round Display settings are saved with pages",
      });
    }
    const bridge = await getBridge(user.id, sw.bridgeid);
    const channels = withSnapshotNames(
      await listSimpleChannels(sw.id),
      snapshotFromJson(bridge?.snapshot),
    );
    return jsonOk({ ...toSwitchPublic(sw), channelSettings: channels });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  const ready = await prepare(context);
  if ("response" in ready) return ready.response;
  const { user, mac } = ready;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  const parsed = parseSimpleChannels((body as { channels?: unknown })?.channels);
  if (!parsed) return jsonError(400, "channels[] is required");

  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    if (isRoundSwitch(sw)) {
      return jsonError(400, "round_switch_uses_pages", {
        details: "Round Display settings are saved with pages",
      });
    }
    if (!supportsChannelTypes(sw.firmware)) {
      return jsonError(409, "firmware_update_required", {
        details: `Update this switch to firmware ${SIMPLE_MIN_FIRMWARE} or later to configure it.`,
      });
    }
    const bridge = await getBridge(user.id, sw.bridgeid);
    const snapshot = snapshotFromJson(bridge?.snapshot);
    if (!snapshot) {
      return jsonError(400, "no topology snapshot for this bridge");
    }
    const resolved = parsed.map((config) => ({
      ...config,
      group: resolvePageGroup(snapshot, config.group) ?? config.group,
    }));
    const invalid = validateSimpleChannels(resolved, sw.channels ?? [], snapshot);
    if (invalid) return jsonError(400, invalid.error, { details: invalid.details });

    const channels = withSnapshotNames(resolved, snapshot);
    const rev = await replaceSimpleChannels(sw.id, channels);
    return jsonOk({ ok: true, mac, rev, channels });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
