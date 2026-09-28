"use client";

// Room and zone cards to pick from: a Round page's group, or a Simple switch's.

import { groupLights, groupScenes } from "@/lib/gestures";
import { pageGroupFromRoom, pickableGroups } from "@/lib/pages";
import type { Room, TopologySnapshot } from "@/lib/types";

function roomCounts(room: Room, snapshot: TopologySnapshot): string {
  const group = pageGroupFromRoom(room);
  const lights = group ? groupLights(snapshot, group).length : 0;
  const scenes = group ? groupScenes(snapshot, group).length : 0;
  return `${room.rtype === "zone" ? "Zone" : "Room"} · ${lights} light${lights === 1 ? "" : "s"} · ${scenes} scene${scenes === 1 ? "" : "s"}`;
}

export function RoomGrid({
  snapshot,
  onPick,
  empty,
}: {
  snapshot: TopologySnapshot;
  onPick: (room: Room) => void;
  /** Shown when the snapshot has no room or zone to pick. */
  empty: string;
}) {
  const rooms = pickableGroups(snapshot);
  if (rooms.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
      {rooms.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item)}
          className="flex flex-col items-start gap-0.5 rounded-[10px] border border-line bg-background px-3.5 py-3 text-left hover:border-filament"
        >
          <span className="text-sm font-medium">{item.name}</span>
          <span className="text-xs text-muted">{roomCounts(item, snapshot)}</span>
        </button>
      ))}
    </div>
  );
}
