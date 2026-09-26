import type {
  HueAction,
  Light,
  RecipeTarget,
  Room,
  Scene,
  TargetRtype,
  TopologySnapshot,
} from "@/lib/types";

export function actionLabel(action: HueAction): string {
  switch (action) {
    case "on":
      return "Turn on";
    case "off":
      return "Turn off";
    case "toggle":
      return "Toggle";
    case "recall_scene":
      return "Recall scene";
  }
}

export function actionsForTarget(rtype: TargetRtype): HueAction[] {
  return rtype === "scene" ? ["recall_scene"] : ["on", "off", "toggle"];
}

export function nameForTarget(
  snapshot: TopologySnapshot,
  target: RecipeTarget,
): string | null {
  if (target.rtype === "light") {
    return snapshot.lights.find((light) => light.id === target.rid)?.name ?? null;
  }
  if (target.rtype === "grouped_light") {
    return (
      snapshot.rooms.find((room) => room.grouped_light_id === target.rid)
        ?.name ?? null
    );
  }
  if (target.rtype === "scene") {
    return snapshot.scenes.find((scene) => scene.id === target.rid)?.name ?? null;
  }
  return null;
}

export function isTargetStale(
  snapshot: TopologySnapshot,
  target: RecipeTarget,
): boolean {
  return nameForTarget(snapshot, target) === null;
}

export function actionClause(action: HueAction, targetName: string): string {
  switch (action) {
    case "on":
      return `turn on ${targetName}`;
    case "off":
      return `turn off ${targetName}`;
    case "toggle":
      return `toggle ${targetName}`;
    case "recall_scene":
      return `scene ${targetName}`;
  }
}

export type RoomGroup = {
  room: Room;
  lights: Light[];
  scenes: Scene[];
};

export type GroupedTopology = {
  rooms: RoomGroup[];
  ungroupedLights: Light[];
  ungroupedScenes: Scene[];
};

export function groupTopology(snapshot: TopologySnapshot): GroupedTopology {
  const lightsById = new Map(snapshot.lights.map((light) => [light.id, light]));
  const usedLightIds = new Set<string>();
  const usedSceneIds = new Set<string>();

  const rooms: RoomGroup[] = snapshot.rooms.map((room) => {
    const lights = (room.light_ids ?? [])
      .map((id) => lightsById.get(id))
      .filter((light): light is Light => Boolean(light));
    lights.forEach((light) => usedLightIds.add(light.id));
    const scenes = snapshot.scenes.filter((scene) => scene.group_rid === room.id);
    scenes.forEach((scene) => usedSceneIds.add(scene.id));
    return { room, lights, scenes };
  });

  return {
    rooms,
    ungroupedLights: snapshot.lights.filter((light) => !usedLightIds.has(light.id)),
    ungroupedScenes: snapshot.scenes.filter(
      (scene) => !usedSceneIds.has(scene.id),
    ),
  };
}

export function snapshotFromJson(raw: unknown): TopologySnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<TopologySnapshot>;
  if (!row.bridgeid || !Array.isArray(row.lights) || !Array.isArray(row.rooms)) {
    return null;
  }
  return {
    receivedAt: row.receivedAt ?? "",
    bridgeid: row.bridgeid,
    bridgeIp: row.bridgeIp,
    source: row.source,
    lights: row.lights,
    rooms: row.rooms,
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
  };
}
