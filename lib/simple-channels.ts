// Simple channel model: group → type → target → gestures.
// Spec: docs/specs/finished/simple-channel-types.md.

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
  SimpleGesture,
  SimpleRecipe,
  TopologySnapshot,
} from "@/lib/types";

/** First Simple firmware that reads `channels[]` from the config poll. */
export const SIMPLE_MIN_FIRMWARE = "0.3.0";

/** First Simple firmware that runs a `dim` hold. */
export const SIMPLE_DIM_FIRMWARE = "0.4.0";

export const BOOT_CHANNEL_ID = "boot";

function atLeast(firmware: string | null | undefined, version: string): boolean {
  const cmp = compareVersions(firmware ?? "", version);
  return cmp === 0 || cmp === 1;
}

export function supportsChannelTypes(firmware: string | null | undefined): boolean {
  return atLeast(firmware, SIMPLE_MIN_FIRMWARE);
}

export function supportsHoldDim(firmware: string | null | undefined): boolean {
  return atLeast(firmware, SIMPLE_DIM_FIRMWARE);
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
    double: null,
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

/** Hold turn off only exists when the click controls less than the whole group. */
export function holdOffAvailable(config: SimpleChannelConfig): boolean {
  return config.target.rtype !== "grouped_light";
}

/** New click target; drops a hold turn off that would now repeat the click. */
export function withTarget(
  config: SimpleChannelConfig,
  target: RecipeTarget,
): SimpleChannelConfig {
  const next = { ...config, target };
  return next.hold?.action === "off" && !holdOffAvailable(next)
    ? { ...next, hold: null }
    : next;
}

export function withKind(
  config: SimpleChannelConfig,
  kind: ChannelKind,
): SimpleChannelConfig {
  if (isBootChannel(config.id) || config.kind === kind) return config;
  // Carry a scene list across: toggle-switch double-click <-> push-button double-click.
  if (kind === "momentary") {
    return {
      ...config,
      kind,
      scenes: [],
      // Same scene list, now on the push-button double-click.
      double:
        config.scenes.length > 0
          ? { action: "recall_scene", targets: config.scenes }
          : null,
      hold: null,
    };
  }
  return {
    ...config,
    kind,
    scenes: config.double?.action === "recall_scene" ? config.double.targets : [],
    double: null,
    hold: null,
  };
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
    if (config.double) {
      recipes.push({ channelId: config.id, event: "double_click", ...config.double });
    }
    if (config.hold) {
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
  const renameGesture = (gesture: SimpleGesture | null): SimpleGesture | null =>
    gesture?.action === "recall_scene"
      ? { action: "recall_scene", targets: rename(gesture.targets) }
      : gesture;
  return configs.map((config) => ({
    ...config,
    group: resolvePageGroup(snapshot, config.group) ?? config.group,
    scenes: rename(config.scenes),
    double: renameGesture(config.double),
    hold: renameGesture(config.hold),
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

function checkGesture(
  gesture: SimpleGesture,
  group: PageGroup,
  snapshot: TopologySnapshot,
  what: string,
): SimpleValidationError | null {
  if (gesture.action === "recall_scene") {
    if (gesture.targets.length === 0) {
      return fail("validation_error", `The ${what} scene list is empty`);
    }
    return checkScenes(gesture.targets, group, snapshot, `The ${what} list`);
  }
  return checkTarget(gesture.target, group, snapshot);
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
    if (config.kind === "maintained") {
      if (config.double || config.hold) {
        return fail(
          "channel_kind_not_allowed",
          "A toggle switch has no hold, and its double-click only cycles scenes.",
        );
      }
      const scenesError = checkScenes(config.scenes, group, snapshot, "The double-click list");
      if (scenesError) return scenesError;
      continue;
    }
    if (config.scenes.length > 0) {
      return fail("channel_kind_not_allowed", "A push button sets its double-click as an action, not a scene list.");
    }
    // Click already toggles the target, so the other gestures only get what a click cannot do.
    if (config.double && config.double.action !== "recall_scene") {
      return fail("channel_kind_not_allowed", "A push button's double-click cycles scenes.");
    }
    if (config.hold && config.hold.action !== "dim" && config.hold.action !== "off") {
      return fail("channel_kind_not_allowed", "A push button's hold dims, or turns off the whole room or zone.");
    }
    if (config.hold?.action === "off") {
      if (
        config.hold.target.rtype !== "grouped_light" ||
        config.hold.target.rid !== group.groupedLightRid
      ) {
        return fail("target_outside_group", "Hold turns off the whole room or zone.");
      }
      if (config.target.rtype === "grouped_light") {
        return fail("validation_error", "Hold turn off repeats the click when the click already controls the whole room or zone.");
      }
    }
    for (const [gesture, what] of [
      [config.double, "double-click"],
      [config.hold, "hold"],
    ] as const) {
      if (!gesture) continue;
      const gestureError = checkGesture(gesture, group, snapshot, what);
      if (gestureError) return gestureError;
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
  const sceneStale = (item: SceneListItem) =>
    isTargetStale(snapshot, { rtype: "scene", rid: item.rid });
  if (config.scenes.some(sceneStale)) return true;
  return [config.double, config.hold].some((gesture) =>
    gesture?.action === "recall_scene"
      ? gesture.targets.some(sceneStale)
      : gesture
        ? isTargetStale(snapshot, gesture.target)
        : false,
  );
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
    const clean = (gesture: SimpleGesture | null): SimpleGesture | null => {
      if (gesture?.action === "recall_scene") {
        const targets = alive(gesture.targets);
        return targets.length > 0 ? { action: "recall_scene", targets } : null;
      }
      if (gesture && isTargetStale(snapshot, gesture.target)) {
        return { ...gesture, target };
      }
      return gesture;
    };
    return {
      ...config,
      group,
      target,
      scenes: alive(config.scenes),
      double: clean(config.double),
      hold: clean(config.hold),
    };
  });
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
  const gestureKey = (gesture: SimpleGesture | null) =>
    gesture
      ? gesture.action === "recall_scene"
        ? [gesture.action, gesture.targets.map((item) => item.rid)]
        : [gesture.action, gesture.target.rtype, gesture.target.rid]
      : null;
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
          gestureKey(config.double),
          gestureKey(config.hold),
        ]),
      )
      .sort()
      .join(";");
  return serialize(a) === serialize(b);
}
