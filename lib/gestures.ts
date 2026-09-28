// Sentences for a gesture card header and a Simple channel's summary line
// (docs/specs/design-bridge-v2/README.md, "Summary sentences").

import { nameForTarget } from "@/lib/recipes";
import { isBootChannel } from "@/lib/simple-channels";
import type {
  Light,
  PageGroup,
  RecipeTarget,
  Scene,
  SceneListItem,
  SimpleChannelConfig,
  SimpleGesture,
  TopologySnapshot,
} from "@/lib/types";

/** What a gesture card shows as its action. `onoff` is a wall switch's lever. */
export type GestureAction = "none" | "toggle" | "on" | "off" | "dim" | "onoff" | "scenes";

/** "all of Kitchen" for a room or zone, otherwise the light's name. */
export function describeTarget(
  target: RecipeTarget | null | undefined,
  snapshot: TopologySnapshot,
): string {
  if (!target) return "unknown target";
  const name = nameForTarget(snapshot, target);
  if (!name) return "unknown target";
  return target.rtype === "grouped_light" ? `all of ${name}` : name;
}

function sceneName(item: SceneListItem, snapshot: TopologySnapshot): string {
  return (
    item.name ||
    nameForTarget(snapshot, { rtype: "scene", rid: item.rid }) ||
    "unknown scene"
  );
}

export function summarizeGesture(
  action: GestureAction,
  target: RecipeTarget | null | undefined,
  scenes: SceneListItem[],
  snapshot: TopologySnapshot,
  empty: string,
): string {
  const t = () => describeTarget(target, snapshot);
  switch (action) {
    case "none":
      return empty;
    case "toggle":
      return `Toggles ${t()}`;
    case "on":
      return `Turns on ${t()}`;
    case "off":
      return `Turns off ${t()}`;
    case "dim":
      return `Dims ${t()} up or down while held`;
    case "onoff":
      return `Lever up turns on, down turns off ${t()}`;
    case "scenes":
      if (scenes.length === 0) return "Cycles scenes — none picked yet";
      if (scenes.length === 1) return `Recalls ${sceneName(scenes[0], snapshot)}`;
      return `Cycles ${scenes.map((item) => sceneName(item, snapshot)).join(" → ")}`;
  }
}

export function groupLights(snapshot: TopologySnapshot, group: PageGroup): Light[] {
  const room = snapshot.rooms.find((item) => item.id === group.rid);
  const ids = room?.light_ids ?? [];
  return ids
    .map((id) => snapshot.lights.find((light) => light.id === id))
    .filter((light): light is Light => Boolean(light));
}

export function groupScenes(snapshot: TopologySnapshot, group: PageGroup): Scene[] {
  return snapshot.scenes.filter((scene) => scene.group_rid === group.rid);
}

/** The current target when it is still in the group, otherwise the whole group. */
export function targetInGroup(
  target: RecipeTarget | null | undefined,
  group: PageGroup,
  snapshot: TopologySnapshot,
): RecipeTarget {
  if (target?.rtype === "grouped_light" && target.rid === group.groupedLightRid) {
    return target;
  }
  if (
    target?.rtype === "light" &&
    groupLights(snapshot, group).some((light) => light.id === target.rid)
  ) {
    return target;
  }
  return { rtype: "grouped_light", rid: group.groupedLightRid };
}

export type GestureSlot = "primary" | "double" | "hold";

/** One gesture of a configured Simple channel or a Round page, with its sentence. */
export type GestureSummary = {
  slot: GestureSlot;
  label: string;
  action: GestureAction;
  summary: string;
  target: RecipeTarget | null;
  scenes: SceneListItem[];
};

export function gestureAction(gesture: SimpleGesture | null): GestureAction {
  if (!gesture) return "none";
  return gesture.action === "recall_scene" ? "scenes" : gesture.action;
}

export function gestureTarget(gesture: SimpleGesture | null): RecipeTarget | null {
  return gesture && gesture.action !== "recall_scene" ? gesture.target : null;
}

export function gestureScenes(gesture: SimpleGesture | null): SceneListItem[] {
  return gesture?.action === "recall_scene" ? gesture.targets : [];
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * The gestures a configured Simple channel has. `wantsScenes` shows a wall switch's
 * double-click as Cycle scenes while the editor has it open with no scene picked yet.
 */
export function simpleChannelGestures(
  config: SimpleChannelConfig,
  snapshot: TopologySnapshot,
  wantsScenes = false,
): GestureSummary[] {
  if (config.kind === "maintained") {
    const doubleAction: GestureAction =
      config.scenes.length > 0 || wantsScenes ? "scenes" : "none";
    return [
      {
        slot: "primary",
        label: "On / Off",
        action: "onoff",
        summary: summarizeGesture("onoff", config.target, [], snapshot, ""),
        target: config.target,
        scenes: [],
      },
      {
        slot: "double",
        label: "Double-click",
        action: doubleAction,
        summary: summarizeGesture(doubleAction, null, config.scenes, snapshot, "Does nothing"),
        target: null,
        scenes: config.scenes,
      },
    ];
  }
  const doubleAction = gestureAction(config.double);
  const holdAction = gestureAction(config.hold);
  return [
    {
      slot: "primary",
      label: "Click",
      action: "toggle",
      summary: summarizeGesture("toggle", config.target, [], snapshot, ""),
      target: config.target,
      scenes: [],
    },
    {
      slot: "double",
      label: "Double-click",
      action: doubleAction,
      summary: summarizeGesture(
        doubleAction,
        null,
        gestureScenes(config.double),
        snapshot,
        "Does nothing",
      ),
      target: null,
      scenes: gestureScenes(config.double),
    },
    {
      slot: "hold",
      label: "Hold",
      action: holdAction,
      summary: summarizeGesture(
        holdAction,
        gestureTarget(config.hold),
        gestureScenes(config.hold),
        snapshot,
        isBootChannel(config.id) ? "Re-pairs with the Bridge" : "Does nothing",
      ),
      target: gestureTarget(config.hold),
      scenes: gestureScenes(config.hold),
    },
  ];
}

/** "Label: sentence · Label: sentence" for a list of gestures. */
export function gesturesLine(gestures: { label: string; summary: string }[]): string {
  return gestures.map((gesture) => `${gesture.label}: ${lowerFirst(gesture.summary)}`).join(" · ");
}
