import { agoText, minutesSince } from "@/lib/ago";
import type { LoadedBridge } from "@/lib/bridge-switches";

/** A Bridge section's heading line: which Bridge, what its snapshot holds, how old it is. */
export function BridgeContext({ bridge }: { bridge: LoadedBridge }) {
  const { snapshot } = bridge;
  const rooms = snapshot.rooms.filter((room) => room.rtype !== "zone").length;
  const zones = snapshot.rooms.length - rooms;
  const age = minutesSince(bridge.updatedAt);
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted">
      <span>
        Bridge <span className="font-mono text-foreground">{bridge.bridgeid}</span>
      </span>
      {bridge.bridgeIp ? <span className="font-mono">{bridge.bridgeIp}</span> : null}
      <span>
        {plural(snapshot.lights.length, "light")} · {plural(rooms, "room")} ·{" "}
        {plural(zones, "zone")} · {plural(snapshot.scenes.length, "scene")}
      </span>
      <span>Snapshot {age === null ? "age unknown" : agoText(age)}</span>
    </p>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
