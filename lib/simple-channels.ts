// Simple channel model: group → type → target → gestures.
// Spec: docs/specs/simple-channel-types.md.

import {
  MAX_SCENE_LIST,
  pageGroupFromRoom,
  resolvePageGroup,
  sceneGroupRid,
  sceneListItem,
  targetBelongsToGroup,
} from "@/lib/pages";
import { isTargetStale, nameForTarget } from "@/lib/recipes";
import { compareVersions } from "@/lib/web-setup/devices";
import type {
  Channel,
  ChannelKind,
  PageGroup,
  RecipeTarget,
  Room,
  SceneListItem,
  SimpleChannelConfig,
  SimpleHold,
  SimpleRecipe,
  TopologySnapshot,
} from "@/lib/types";

/** First Simple firmware that reads `channels[]` from the config poll. */
export const SIMPLE_MIN_FIRMWARE = "0.3.0";

export const BOOT_CHANNEL_ID = "boot";

export function supportsChannelTypes(firmware: string | null | undefined): boolean {
  const cmp = compareVersions(firmware ?? "", SIMPLE_MIN_FIRMWARE);
  return cmp === 0 || cmp === 1;
}

export function isBootChannel(channelId: string): boolean {
  return channelId === BOOT_CHANNEL_ID;
}

export function kindLabel(kind: ChannelKind): string {
  return kind === "momentary" ? "Push button" : "Toggle switch";
}

export function defaultSimpleChannel(
  channelId: string,
  group: PageGroup,
): SimpleChannelConfig {
  return {
    id: channelId,
    kind: isBootChannel(channelId) ? "momentary" : "maintained",
    group,
    target: { rtype: "grouped_light", rid: group.groupedLightRid },
    scenes: [],
    hold: null,
  };
}

/** Move a channel to another room or zone: target resets to the whole group, scenes are dropped. */
export function withGroup(
  config: SimpleChannelConfig,
  group: PageGroup,
): SimpleChannelConfig {
  if (config.group.rid === group.rid) return config;
  const next = defaultSimpleChannel(config.id, group);
  return { ...next, kind: config.kind };
}

export function withKind(
  config: SimpleChannelConfig,
  kind: ChannelKind,
): SimpleChannelConfig {
  if (isBootChannel(config.id)) return config;
  return { ...config, kind, scenes: kind === "maintained" ? config.scenes : [] };
}

/** Recipes the switch runs, derived from the channel settings. */
export function deriveSimpleRecipes(
  configs: SimpleChannelConfig[],
): SimpleRecipe[] {
  const recipes: SimpleRecipe[] = [];
  for (const config of configs) {
    const target = config.target;
    if (config.kind === "maintained") {
      recipes.push({ channelId: config.id, event: "on", action: "on", target });
      recipes.push({ channelId: config.id, event: "off", action: "off", target });
      if (config.scenes.length > 0) {
        recipes.push({
          channelId: config.id,
          event: "double_click",
          action: "recall_scene",
          targets: config.scenes,
        });
      }
      continue;
    }
    recipes.push({ channelId: config.id, event: "short", action: "toggle", target });
    if (isBootChannel(config.id) && config.hold) {
      recipes.push({ channelId: config.id, event: "hold", ...config.hold });
    }
  }
  return recipes;
}

export function deviceSimpleChannel(config: SimpleChannelConfig) {
  return {
    id: config.id,
    kind: config.kind,
    group: {
      rtype: config.group.rtype,
      rid: config.group.rid,
      groupedLightRid: config.group.groupedLightRid,
    },
  };
}

export function deviceSimpleRecipe(recipe: SimpleRecipe): Record<string, unknown> {
  if (recipe.action === "recall_scene") {
    return {
      channelId: recipe.channelId,
      event: recipe.event,
      action: recipe.action,
      targets: (recipe.targets ?? []).map((item) => ({
        rtype: "scene" as const,
        rid: item.rid,
        name: item.name,
      })),
    };
  }
  return {
    channelId: recipe.channelId,
    event: recipe.event,
    action: recipe.action,
    target: recipe.target,
  };
}

/** Refresh scene names (and the group's grouped_light) from the latest snapshot. */
export function withSnapshotNames(
  configs: SimpleChannelConfig[],
  snapshot: TopologySnapshot | null,
): SimpleChannelConfig[] {
  if (!snapshot) return configs;
  const rename = (items: SceneListItem[]) =>
    items.map((item) => sceneListItem(snapshot, item.rid, item.name));
  return configs.map((config) => ({
    ...config,
    group: resolvePageGroup(snapshot, config.group) ?? config.group,
    scenes: rename(config.scenes),
    hold:
      config.hold?.action === "recall_scene"
        ? { action: "recall_scene", targets: rename(config.hold.targets) }
        : config.hold,
  }));
}

export type SimpleValidationError = { error: string; details: string };

function fail(error: string, details: string): SimpleValidationError {
  return { error, details };
}

function checkScenes(
  scenes: SceneListItem[],
  group: PageGroup,
  snapshot: TopologySnapshot,
  what: string,
): SimpleValidationError | null {
  if (scenes.length > MAX_SCENE_LIST) {
    return fail("validation_error", `${what} can have at most ${MAX_SCENE_LIST} scenes`);
  }
  const seen = new Set<string>();
  for (const scene of scenes) {
    if (seen.has(scene.rid)) {
      return fail("validation_error", `${what} lists a scene twice`);
    }
    seen.add(scene.rid);
    const groupRid = sceneGroupRid(snapshot, scene.rid);
    if (!groupRid) return fail("validation_error", `unknown scene rid ${scene.rid}`);
    if (groupRid !== group.rid) {
      return fail("scene_outside_group", "Scenes must belong to the channel's room or zone.");
    }
  }
  return null;
}

function checkTarget(
  target: RecipeTarget,
  group: PageGroup,
  snapshot: TopologySnapshot,
): SimpleValidationError | null {
  if (target.rtype !== "light" && target.rtype !== "grouped_light") {
    return fail("validation_error", "target must be a light or the whole room or zone");
  }
  if (!targetBelongsToGroup(target, group, snapshot)) {
    return fail("target_outside_group", "The target must be the channel's room or zone, or a light in it.");
  }
  return null;
}

export function validateSimpleChannels(
  configs: SimpleChannelConfig[],
  registered: Channel[],
  snapshot: TopologySnapshot,
): SimpleValidationError | null {
  const known = new Set(registered.map((channel) => channel.id));
  const seen = new Set<string>();
  for (const config of configs) {
    if (!known.has(config.id)) {
      return fail("invalid_channel", `unknown channel ${config.id}`);
    }
    if (seen.has(config.id)) {
      return fail("invalid_channel", `channel ${config.id} is listed twice`);
    }
    seen.add(config.id);
    const boot = isBootChannel(config.id);
    if (boot && config.kind !== "momentary") {
      return fail("channel_kind_not_allowed", "BOOT is always a push button.");
    }
    const group = resolvePageGroup(snapshot, config.group);
    if (!group) {
      return fail("validation_error", `unknown room or zone for ${config.id}`);
    }
    const targetError = checkTarget(config.target, group, snapshot);
    if (targetError) return targetError;
    if (config.kind !== "maintained" && config.scenes.length > 0) {
      return fail("channel_kind_not_allowed", "Only a toggle switch cycles scenes on double-click.");
    }
    const scenesError = checkScenes(config.scenes, group, snapshot, "The double-click list");
    if (scenesError) return scenesError;
    if (config.hold) {
      if (!boot) {
        return fail("channel_kind_not_allowed", "Only BOOT has a configurable hold.");
      }
      if (config.hold.action === "recall_scene") {
        if (config.hold.targets.length === 0) {
          return fail("validation_error", "The hold scene list is empty");
        }
        const holdError = checkScenes(config.hold.targets, group, snapshot, "The hold list");
        if (holdError) return holdError;
      } else {
        const holdTargetError = checkTarget(config.hold.target, group, snapshot);
        if (holdTargetError) return holdTargetError;
      }
    }
  }
  return null;
}

export function isSimpleChannelStale(
  config: SimpleChannelConfig,
  snapshot: TopologySnapshot,
): boolean {
  if (!resolvePageGroup(snapshot, config.group)) return true;
  if (isTargetStale(snapshot, config.target)) return true;
  const scenes = [
    ...config.scenes,
    ...(config.hold?.action === "recall_scene" ? config.hold.targets : []),
  ];
  return scenes.some((item) => isTargetStale(snapshot, { rtype: "scene", rid: item.rid }));
}

/** Drop missing scenes; a missing light falls back to the whole group. Missing groups stay (the user picks another). */
export function clearStaleSimple(
  configs: SimpleChannelConfig[],
  snapshot: TopologySnapshot,
): SimpleChannelConfig[] {
  const alive = (items: SceneListItem[]) =>
    items.filter((item) => !isTargetStale(snapshot, { rtype: "scene", rid: item.rid }));
  return configs.map((config) => {
    const group = resolvePageGroup(snapshot, config.group);
    if (!group) return config;
    const target = isTargetStale(snapshot, config.target)
      ? { rtype: "grouped_light" as const, rid: group.groupedLightRid }
      : config.target;
    let hold: SimpleHold | null = config.hold;
    if (hold?.action === "recall_scene") {
      const targets = alive(hold.targets);
      hold = targets.length > 0 ? { action: "recall_scene", targets } : null;
    } else if (hold && isTargetStale(snapshot, hold.target)) {
      hold = { ...hold, target };
    }
    return { ...config, group, target, scenes: alive(config.scenes), hold };
  });
}

function sceneNames(items: SceneListItem[], snapshot: TopologySnapshot): string {
  return items
    .map(
      (item) =>
        item.name ||
        nameForTarget(snapshot, { rtype: "scene", rid: item.rid }) ||
        "unknown scene",
    )
    .join(", ");
}

export function targetName(
  target: RecipeTarget,
  group: PageGroup,
  snapshot: TopologySnapshot,
): string {
  const groupName = groupRoom(snapshot, group)?.name ?? "unknown group";
  if (target.rtype === "grouped_light") return `all of ${groupName}`;
  return nameForTarget(snapshot, target) ?? "unknown light";
}

function holdClause(hold: SimpleHold | null, group: PageGroup, snapshot: TopologySnapshot): string {
  if (!hold) return "hold re-pairs with the Bridge";
  if (hold.action === "recall_scene") {
    return hold.targets.length === 1
      ? `hold → scene ${sceneNames(hold.targets, snapshot)}`
      : `hold → cycle ${sceneNames(hold.targets, snapshot)}`;
  }
  const verb = hold.action === "toggle" ? "toggle" : hold.action === "on" ? "turn on" : "turn off";
  return `hold → ${verb} ${targetName(hold.target, group, snapshot)}`;
}

/** e.g. "D0 · Living · toggle switch: on/off all of Living · double-click cycles Relax, Bright". */
export function confirmationForSimpleChannel(
  label: string,
  config: SimpleChannelConfig | undefined,
  snapshot: TopologySnapshot,
): string {
  if (!config) return `${label} · not used`;
  const groupName = groupRoom(snapshot, config.group)?.name ?? "unknown group";
  const target = targetName(config.target, config.group, snapshot);
  if (config.kind === "maintained") {
    const dbl =
      config.scenes.length === 0
        ? "double-click turns on"
        : config.scenes.length === 1
          ? `double-click → scene ${sceneNames(config.scenes, snapshot)}`
          : `double-click cycles ${sceneNames(config.scenes, snapshot)}`;
    return `${label} · ${groupName} · toggle switch: on/off ${target} · ${dbl}`;
  }
  const parts = [`${label} · ${groupName} · push button: click toggles ${target}`];
  if (isBootChannel(config.id)) parts.push(holdClause(config.hold, config.group, snapshot));
  return parts.join(" · ");
}

export function groupRoom(
  snapshot: TopologySnapshot,
  group: PageGroup,
): Room | undefined {
  return snapshot.rooms.find((room) => room.id === group.rid);
}

export function groupFromRoomId(
  snapshot: TopologySnapshot,
  roomId: string,
): PageGroup | null {
  const room = snapshot.rooms.find((item) => item.id === roomId);
  return room ? pageGroupFromRoom(room) : null;
}

export function simpleChannelsEqual(
  a: SimpleChannelConfig[],
  b: SimpleChannelConfig[],
): boolean {
  const serialize = (list: SimpleChannelConfig[]) =>
    [...list]
      .map((config) =>
        JSON.stringify([
          config.id,
          config.kind,
          config.group.rid,
          config.target.rtype,
          config.target.rid,
          config.scenes.map((item) => item.rid),
          config.hold
            ? config.hold.action === "recall_scene"
              ? [config.hold.action, config.hold.targets.map((item) => item.rid)]
              : [config.hold.action, config.hold.target.rtype, config.hold.target.rid]
            : null,
        ]),
      )
      .sort()
      .join(";");
  return serialize(a) === serialize(b);
}
