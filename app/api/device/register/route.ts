import {
  getSwitchByMac,
  upsertBridge,
  upsertSwitch,
} from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { accountLimits, recordRegisterRefused, registerLimitHit } from "@/lib/limits";
import {
  asString,
  parseChannels,
  parseLights,
  parseMac,
  parseProduct,
  parseRooms,
  parseScenes,
} from "@/lib/parse";
import type { TopologySnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }

  try {
    await ensureSchema();
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }

  let device;
  try {
    device = await authenticateDevice(req);
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
  if (!device) return jsonError(401, "unauthorized");
  if (device.suspended) return jsonError(403, "account_suspended");

  let limits;
  let text: string;
  try {
    limits = await accountLimits(device.userId);
    text = await req.text();
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
  if (Buffer.byteLength(text) > limits.snapshotKb * 1024) {
    await recordRegisterRefused(device.userId, "payload_too_large").catch(() => {});
    return jsonError(413, "payload_too_large", { details: `limit ${limits.snapshotKb} KB` });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "invalid_json");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_payload");
  }

  const raw = body as Record<string, unknown>;
  const bridgeid = asString(raw.bridgeid);
  const lights = parseLights(raw.lights);
  const rooms = parseRooms(raw.rooms);
  const scenes = parseScenes(raw.scenes);
  const channels = parseChannels(raw.channels);
  const mac = parseMac(raw.mac);
  const product = parseProduct(raw.product);
  if (mac === null) {
    return jsonError(400, "mac must be 12 hex digits");
  }
  if (!bridgeid || !lights || !rooms || !scenes) {
    return jsonError(
      400,
      "bridgeid, lights[], rooms[], scenes[] are required arrays (empty [] is allowed)",
    );
  }
  if (!channels) {
    return jsonError(400, "channels[] is invalid");
  }

  const snapshot: TopologySnapshot = {
    receivedAt: new Date().toISOString(),
    bridgeid,
    bridgeIp: asString(raw.bridge_ip),
    source: asString(raw.source) ?? (mac ? "xiao" : "unknown"),
    lights,
    rooms,
    scenes,
  };

  try {
    const hit = await registerLimitHit({ userId: device.userId, limits, mac: mac ?? null, bridgeid });
    if (hit) {
      await recordRegisterRefused(device.userId, `limit_reached:${hit}`);
      return jsonError(403, "limit_reached", { details: hit });
    }
    await upsertBridge({ userId: device.userId, snapshot });
    if (!mac) {
      return jsonOk({
        ok: true,
        bridgeid,
        lights: lights.length,
        rooms: rooms.length,
        scenes: scenes.length,
      });
    }

    const sw = await upsertSwitch({
      userId: device.userId,
      mac,
      label: asString(raw.label),
      firmware: asString(raw.firmware),
      bridgeid,
      bridgeIp: asString(raw.bridge_ip),
      channels,
      apiKeyId: device.keyId,
      product,
    });
    const stored = await getSwitchByMac(device.userId, mac);

    return jsonOk({
      ok: true,
      mac: sw.mac,
      bridgeid: sw.bridgeid,
      rev: stored?.rev ?? sw.rev,
      product: stored?.product ?? sw.product,
      lights: lights.length,
      rooms: rooms.length,
      scenes: scenes.length,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
