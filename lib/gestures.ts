// Sentences for a gesture card header and a Simple channel's summary line
// (docs/specs/design-bridge-v2/README.md, "Summary sentences").

import { nameForTarget } from "@/lib/recipes";
import type {
  Light,
  PageGroup,
  RecipeTarget,
  Scene,
  SceneListItem,
  TopologySnapshot,
} from "@/lib/types";

/** What a gesture card shows as its action. `onoff` is a toggle switch's lever. */
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
