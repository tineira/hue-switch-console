import type {
  Channel,
  ChannelEvent,
  ChannelKind,
  HueAction,
  Light,
  Recipe,
  Room,
  Scene,
  TargetRtype,
} from "@/lib/types";
import { normalizeMac } from "@/lib/mac";

const KINDS: ChannelKind[] = ["maintained", "momentary"];
const EVENTS: ChannelEvent[] = ["on", "off", "double_click", "short"];
const ACTIONS: HueAction[] = ["on", "off", "recall_scene", "toggle"];
const RTYPES: TargetRtype[] = ["light", "grouped_light", "scene"];

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isKind(value: unknown): value is ChannelKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

function isEvent(value: unknown): value is ChannelEvent {
  return typeof value === "string" && (EVENTS as string[]).includes(value);
}

function isAction(value: unknown): value is HueAction {
  return typeof value === "string" && (ACTIONS as string[]).includes(value);
}

function isRtype(value: unknown): value is TargetRtype {
  return typeof value === "string" && (RTYPES as string[]).includes(value);
}

export function parseLights(raw: unknown): Light[] | null {
  if (!Array.isArray(raw)) return null;
  const lights: Light[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name);
    if (!id || !name) return null;
    const caps = Array.isArray(row.caps)
      ? row.caps.filter((c): c is string => typeof c === "string")
      : undefined;
    lights.push({
      id,
      name,
      on: typeof row.on === "boolean" ? row.on : undefined,
      caps,
    });
  }
  return lights;
}

export function parseRooms(raw: unknown): Room[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const rooms: Room[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name);
    if (!id || !name) return null;
    const grouped =
      asString(row.grouped_light_id) ??
      (row.grouped_light_id === null ? null : undefined);
    const lightIds = Array.isArray(row.light_ids)
      ? row.light_ids.filter((c): c is string => typeof c === "string")
      : [];
    const rtype =
      row.rtype === "room" || row.rtype === "zone" ? row.rtype : undefined;
    rooms.push({
      id,
      name,
      grouped_light_id: grouped ?? null,
      light_ids: lightIds,
      rtype,
    });
  }
  return rooms;
}

export function parseScenes(raw: unknown): Scene[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const scenes: Scene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name);
    if (!id || !name) return null;
    scenes.push({
      id,
      name,
      group_rtype: asString(row.group_rtype) ?? "",
      group_rid: asString(row.group_rid) ?? "",
    });
  }
  return scenes;
}

export function parseChannels(raw: unknown): Channel[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const channels: Channel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const label = asString(row.label) ?? id;
    if (!id || !isKind(row.kind) || !label) return null;
    if (typeof row.gpio !== "number" || !Number.isInteger(row.gpio) || row.gpio < 0) {
      return null;
    }
    channels.push({ id, gpio: row.gpio, label, kind: row.kind });
  }
  return channels;
}

export function parseMac(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return normalizeMac(raw);
}

export function parseRecipes(raw: unknown): Recipe[] | null {
  if (!Array.isArray(raw)) return null;
  const recipes: Recipe[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const channelId = asString(row.channelId);
    const targetRaw = row.target;
    if (
      !channelId ||
      !isEvent(row.event) ||
      !isAction(row.action) ||
      !targetRaw ||
      typeof targetRaw !== "object"
    ) {
      return null;
    }
    const target = targetRaw as Record<string, unknown>;
    const rid = asString(target.rid);
    if (!rid || !isRtype(target.rtype)) return null;
    recipes.push({
      channelId,
      event: row.event,
      action: row.action,
      target: { rtype: target.rtype, rid },
    });
  }
  return recipes;
}
