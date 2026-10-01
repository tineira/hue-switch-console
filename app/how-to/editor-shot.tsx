"use client";

import { useEffect, useRef, useState } from "react";
import { SimpleChannelsEditor, type Adding } from "@/app/switches/simple-channels-editor";
import { pageGroupFromRoom } from "@/lib/pages";
import { BOOT_CHANNEL_ID, defaultSimpleChannel } from "@/lib/simple-channels";
import type { Channel, Room, SimpleChannelConfig, TopologySnapshot } from "@/lib/types";

// The real Simple editor from Switches, with sample rooms, drawn at desktop width and scaled to
// the guide's column. Not interactive: it is a picture that never goes out of date.

const WIDTH = 940;
// The editor's height at WIDTH in each state, so the box has its final size from the first
// paint. Text rendering moves it by a pixel or two between browsers; in development a bigger
// mismatch logs an error naming the number to update.
const HEIGHT: Record<"boot" | "add", number> = { boot: 606, add: 669 };

const CHANNELS: Channel[] = [
  { id: BOOT_CHANNEL_ID, gpio: 9, label: "BOOT" },
  ...[0, 1, 2, 21, 22, 23].map((gpio, i) => ({ id: `d${i}`, gpio, label: `D${i}` })),
];

const ROOMS: Room[] = [
  { id: "room-living", name: "Living room", grouped_light_id: "gl-living", light_ids: ["l1", "l2", "l3"], rtype: "room" },
  { id: "room-kitchen", name: "Kitchen", grouped_light_id: "gl-kitchen", light_ids: ["l4", "l5"], rtype: "room" },
  { id: "room-bedroom", name: "Bedroom", grouped_light_id: "gl-bedroom", light_ids: ["l6"], rtype: "room" },
  { id: "zone-downstairs", name: "Downstairs", grouped_light_id: "gl-down", light_ids: ["l1", "l2", "l3", "l4", "l5"], rtype: "zone" },
];

const SNAPSHOT: TopologySnapshot = {
  receivedAt: "2026-09-30T12:00:00Z",
  bridgeid: "sample",
  lights: ["l1", "l2", "l3", "l4", "l5", "l6"].map((id, i) => ({ id, name: `Light ${i + 1}` })),
  rooms: ROOMS,
  scenes: [
    { id: "s1", name: "Relax", group_rtype: "room", group_rid: "room-living" },
    { id: "s2", name: "Read", group_rtype: "room", group_rid: "room-living" },
    { id: "s3", name: "Bright", group_rtype: "room", group_rid: "room-kitchen" },
  ],
};

const bootInLiving = (): SimpleChannelConfig => defaultSimpleChannel(BOOT_CHANNEL_ID, pageGroupFromRoom(ROOMS[0])!);

const STATES: Record<"boot" | "add", { configs: SimpleChannelConfig[]; initial: { picked?: string; adding?: Adding } }> = {
  boot: { configs: [], initial: { picked: BOOT_CHANNEL_ID } },
  add: { configs: [bootInLiving()], initial: { adding: { kind: "momentary", pin: "d0" } } },
};

export function EditorShot({ state, alt }: { state: "boot" | "add"; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    const measure = () => {
      setScale(Math.min(1, b.clientWidth / WIDTH));
      if (process.env.NODE_ENV !== "production" && Math.abs(i.offsetHeight - HEIGHT[state]) > 4)
        console.error(`EditorShot ${state}: ${i.offsetHeight} px tall at ${WIDTH}; set HEIGHT.${state} = ${i.offsetHeight} in editor-shot.tsx`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(i);
    return () => ro.disconnect();
  }, [state]);

  const { configs, initial } = STATES[state];
  return (
    <div ref={box} role="img" aria-label={alt} className="relative w-full overflow-hidden" style={{ aspectRatio: `${WIDTH} / ${HEIGHT[state]}` }}>
      {/* Hidden until the scale is known (the first paint can't know the column's width), then
          a short fade in; the box around it already has its final size. */}
      <div
        ref={inner}
        inert
        aria-hidden="true"
        className={`absolute left-0 top-0 overflow-hidden rounded-xl border border-line bg-cream${scale === null ? " opacity-0" : " illo-in"}`}
        style={{ width: WIDTH, transform: `scale(${scale ?? 1})`, transformOrigin: "top left" }}
      >
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-base font-semibold">Simple switch</span>
          <span className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink">Save changes</span>
        </div>
        <SimpleChannelsEditor
          mac="sample"
          channels={CHANNELS}
          configs={configs}
          snapshot={SNAPSHOT}
          firmware
          openGesture={null}
          onOpenGesture={() => {}}
          onChange={() => {}}
          onNotice={() => {}}
          initial={initial}
        />
      </div>
    </div>
  );
}
