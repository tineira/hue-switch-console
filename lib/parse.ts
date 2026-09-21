import type {
  Channel,
  ChannelEvent,
  ChannelKind,
  HueAction,
  Light,
  PageGroup,
  PageSwipeAxis,
  Recipe,
  RecipeTarget,
  Room,
  RoundRecipe,
  Scene,
  SceneListItem,
  SwitchPage,
  SwitchProduct,
  TargetRtype,
} from "@/lib/types";
import { normalizeMac } from "@/lib/mac";
import {
  isPageSwipeAxis,
  isRoundEvent,
  isScreenTimeoutSec,
  normalizePageName,
} from "@/lib/pages";
import { isRoundThemeId, normalizeRoundTheme } from "@/lib/round-themes";

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

export function parseProduct(raw: unknown): SwitchProduct | undefined {
  if (raw === "round" || raw === "simple") return raw;
  return undefined;
}

export function parsePageSwipeAxis(raw: unknown): PageSwipeAxis | null {
  if (isPageSwipeAxis(raw)) return raw;
  return null;
}

/** Valid integer timeout, or `undefined` if omitted. `null` = present but invalid. */
export function parseScreenTimeoutSec(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (isScreenTimeoutSec(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (isScreenTimeoutSec(n)) return n;
  }
  return null;
}

function parseRecipeTarget(raw: unknown): RecipeTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const rid = asString(row.rid);
  if (!rid || !isRtype(row.rtype)) return null;
  return { rtype: row.rtype, rid };
}

function parseSceneList(raw: unknown): SceneListItem[] | null {
  if (!Array.isArray(raw)) return null;
  const targets: SceneListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const rid = asString(row.rid);
    if (!rid) return null;
    if (row.rtype !== undefined && row.rtype !== "scene") return null;
    targets.push({
      rtype: "scene",
      rid,
      name: asString(row.name) ?? "",
    });
  }
  return targets;
}

export function parseRoundRecipes(raw: unknown): RoundRecipe[] | null {
  if (!Array.isArray(raw)) return null;
  const recipes: RoundRecipe[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const pageId = asString(row.pageId);
    if (!pageId || !isRoundEvent(row.event) || !isAction(row.action)) {
      return null;
    }
    if (row.action === "recall_scene") {
      const fromTargets = parseSceneList(row.targets);
      const single = parseRecipeTarget(row.target);
      const targets =
        fromTargets && fromTargets.length > 0
          ? fromTargets
          : single && single.rtype === "scene"
            ? [{ rtype: "scene" as const, rid: single.rid, name: "" }]
            : null;
      if (!targets) return null;
      recipes.push({
        pageId,
        event: row.event,
        action: "recall_scene",
        targets,
      });
      continue;
    }
    const target = parseRecipeTarget(row.target);
    if (!target) return null;
    recipes.push({
      pageId,
      event: row.event,
      action: row.action,
      target,
    });
  }
  return recipes;
}

function parsePageGroup(raw: unknown): PageGroup | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const rtype = row.rtype;
  const rid = asString(row.rid);
  const groupedLightRid = asString(row.groupedLightRid);
  if (rtype !== "room" && rtype !== "zone") return undefined;
  if (!rid || !groupedLightRid) return undefined;
  return { rtype, rid, groupedLightRid };
}

export function parseRoundPages(raw: unknown): SwitchPage[] | null {
  if (!Array.isArray(raw)) return null;
  const pages: SwitchPage[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const rawName = asString(row.name);
    if (!rawName) return null;
    const name = normalizePageName(rawName);
    if (!name) return null;
    const themeRaw = asString(row.theme) ?? "ember";
    const theme = isRoundThemeId(themeRaw) ? themeRaw : null;
    if (!theme) return null;
    const group = parsePageGroup(row.group);
    if (group === undefined) return null;
    pages.push({
      id: asString(row.id) ?? "",
      name,
      sortOrder: index,
      theme: normalizeRoundTheme(theme),
      group,
      dim: null,
    });
  }
  return pages;
}
