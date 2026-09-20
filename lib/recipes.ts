import type {
  Channel,
  ChannelEvent,
  ChannelKind,
  HueAction,
  Light,
  Recipe,
  RecipeTarget,
  Room,
  Scene,
  TargetRtype,
  TopologySnapshot,
} from "@/lib/types";

export function eventsForKind(kind: ChannelKind): ChannelEvent[] {
  return kind === "momentary" ? ["short"] : ["on", "off", "double_click"];
}

export function eventLabel(event: ChannelEvent): string {
  switch (event) {
    case "on":
      return "On";
    case "off":
      return "Off";
    case "double_click":
      return "Double-click";
    case "short":
      return "Short press";
  }
}

export function eventLabelShort(event: ChannelEvent): string {
  switch (event) {
    case "double_click":
      return "double-click";
    case "short":
      return "short";
    default:
      return event;
  }
}

export function kindLabel(kind: ChannelKind): string {
  return kind === "momentary" ? "Momentary" : "Maintained";
}

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

export function defaultActionForEvent(event: ChannelEvent): HueAction {
  switch (event) {
    case "on":
      return "on";
    case "off":
      return "off";
    case "double_click":
      return "recall_scene";
    case "short":
      return "toggle";
  }
}

/** Hue action to apply when dropping a target onto a slot. Null = incompatible. */
export function defaultActionForTarget(
  event: ChannelEvent,
  rtype: TargetRtype,
): HueAction | null {
  if (rtype === "scene") {
    return event === "double_click" ? "recall_scene" : null;
  }
  if (event === "on") return "on";
  if (event === "off") return "off";
  if (event === "double_click") return "on";
  if (event === "short") return "toggle";
  return null;
}

export function actionsForTarget(rtype: TargetRtype): HueAction[] {
  return rtype === "scene" ? ["recall_scene"] : ["on", "off", "toggle"];
}

export function targetKey(target: RecipeTarget): string {
  return `${target.rtype}:${target.rid}`;
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

export function confirmationForChannel(
  channel: Channel,
  recipes: Recipe[],
  snapshot: TopologySnapshot,
): string {
  const parts = eventsForKind(channel.kind).map((event) => {
    const rec = recipes.find(
      (recipe) => recipe.channelId === channel.id && recipe.event === event,
    );
    if (!rec) return `${eventLabelShort(event)} → unassigned`;
    const name = nameForTarget(snapshot, rec.target) ?? "unknown target";
    const stale = isTargetStale(snapshot, rec.target)
      ? " (missing from snapshot)"
      : "";
    return `${eventLabelShort(event)} → ${actionClause(rec.action, name)}${stale}`;
  });
  return `${channel.label} ${parts.join(" · ")}`;
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

export function recipesEqual(a: Recipe[], b: Recipe[]): boolean {
  if (a.length !== b.length) return false;
  const serialize = (list: Recipe[]) =>
    [...list]
      .map(
        (r) =>
          `${r.channelId}|${r.event}|${r.action}|${r.target.rtype}|${r.target.rid}`,
      )
      .sort()
      .join(";");
  return serialize(a) === serialize(b);
}

export function validateRecipes(
  recipes: Recipe[],
  channels: Channel[],
  snapshot: TopologySnapshot,
): string | null {
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const lightIds = new Set(snapshot.lights.map((l) => l.id));
  const groupedIds = new Set(
    snapshot.rooms
      .map((r) => r.grouped_light_id)
      .filter((id): id is string => Boolean(id)),
  );
  const sceneIds = new Set(snapshot.scenes.map((s) => s.id));

  for (const rec of recipes) {
    const key = `${rec.channelId}:${rec.event}`;
    if (seen.has(key)) return `duplicate recipe for ${key}`;
    seen.add(key);

    const channel = channelById.get(rec.channelId);
    if (!channel) return `unknown channelId ${rec.channelId}`;
    if (!eventsForKind(channel.kind).includes(rec.event)) {
      return `event ${rec.event} is not valid for ${channel.kind} channel ${channel.id}`;
    }

    if (rec.action === "recall_scene") {
      if (rec.target.rtype !== "scene") {
        return "recall_scene requires target.rtype scene";
      }
    } else if (rec.target.rtype === "scene") {
      return `${rec.action} cannot target a scene`;
    } else if (
      rec.target.rtype !== "light" &&
      rec.target.rtype !== "grouped_light"
    ) {
      return `invalid rtype ${rec.target.rtype}`;
    }

    if (rec.target.rtype === "light" && !lightIds.has(rec.target.rid)) {
      return `unknown light rid ${rec.target.rid}`;
    }
    if (
      rec.target.rtype === "grouped_light" &&
      !groupedIds.has(rec.target.rid)
    ) {
      return `unknown grouped_light rid ${rec.target.rid}`;
    }
    if (rec.target.rtype === "scene" && !sceneIds.has(rec.target.rid)) {
      return `unknown scene rid ${rec.target.rid}`;
    }
  }
  return null;
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
