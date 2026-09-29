import {
  getSwitchByMac,
  upsertBridge,
  upsertSwitch,
} from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { databaseError, jsonError, jsonOk } from "@/lib/http";
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
    return databaseError(err);
  }

  let device;
  try {
    device = await authenticateDevice(req);
  } catch (err) {
    return databaseError(err);
  }
  if (!device) return jsonError(401, "unauthorized");
  if (device.suspended) return jsonError(403, "account_suspended");

  let limits;
  let text: string;
  try {
    limits = await accountLimits(device.userId);
    text = await req.text();
  } catch (err) {
    return databaseError(err);
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
    const bridge = await upsertBridge({ userId: device.userId, snapshot });
    const snapshotStatus = bridge.kept ? "kept" : "stored";
    if (!mac) {
      return jsonOk({
        ok: true,
        bridgeid,
        lights: lights.length,
        rooms: rooms.length,
        scenes: scenes.length,
        snapshot: snapshotStatus,
      });
    }

    if (!product) {
      // Deprecated path (docs/specs/require-product-on-register.md, phase 1): the product is
      // still inferred from the channels. Logged so the remaining boards show up in the logs.
      console.warn(
        `register without product (deprecated): mac=${mac} firmware=${asString(raw.firmware) ?? "unknown"}`,
      );
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
      snapshot: snapshotStatus,
    });
  } catch (err) {
    return databaseError(err);
  }
}
