import type { RecipeTarget, TopologySnapshot } from "@/lib/types";

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
