"use client";

import {
  GesturePicker,
  choiceClass,
  type GestureOption,
} from "@/app/switches/gesture-picker";
import {
  gestureTarget,
  gesturesLine,
  simpleChannelGestures,
  targetInGroup,
  type GestureAction,
  type GestureSlot,
  type GestureSummary,
} from "@/lib/gestures";
import { pickableGroups } from "@/lib/pages";
import {
  SIMPLE_DIM_FIRMWARE,
  SIMPLE_MIN_FIRMWARE,
  defaultSimpleChannel,
  groupFromRoomId,
  groupRoom,
  holdOffAvailable,
  isBootChannel,
  isSimpleChannelStale,
  kindLabel,
  withGroup,
  withKind,
  withTarget,
} from "@/lib/simple-channels";
import type {
  Channel,
  ChannelKind,
  RecipeTarget,
  SceneListItem,
  SimpleChannelConfig,
  SimpleGesture,
  TopologySnapshot,
} from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

type GestureView = GestureSummary & {
  options?: GestureOption[];
  fixedTarget?: boolean;
};

const SCENE_OPTIONS: GestureOption[] = [
  { value: "none", label: "Nothing" },
  { value: "scenes", label: "Cycle scenes" },
];

/** The gesture cards a configured channel shows, with their summaries and choices. */
function channelGestures(
  config: SimpleChannelConfig,
  snapshot: TopologySnapshot,
  dimSupported: boolean,
  wantsScenes: boolean,
): GestureView[] {
  const boot = isBootChannel(config.id);
  const roomName = groupRoom(snapshot, config.group)?.name ?? "the group";
  return simpleChannelGestures(config, snapshot, wantsScenes).map((gesture) => {
    if (gesture.slot === "double") return { ...gesture, options: SCENE_OPTIONS };
    if (gesture.slot !== "hold") return gesture;
    const holdOptions: GestureOption[] = [
      { value: "none", label: boot ? "Re-pair with Bridge" : "Nothing" },
      {
        value: "dim",
        label: dimSupported ? "Dim" : `Dim (needs firmware ${SIMPLE_DIM_FIRMWARE})`,
        disabled: !dimSupported && gesture.action !== "dim",
      },
    ];
    if (holdOffAvailable(config) || gesture.action === "off") {
      holdOptions.push({ value: "off", label: `Turn off all of ${roomName}` });
    }
    return { ...gesture, options: holdOptions, fixedTarget: gesture.action === "off" };
  });
}

/** Changing the action keeps what still fits: the current target if it is in the group, or the scene list. */
function gestureFromAction(
  action: GestureAction,
  config: SimpleChannelConfig,
  current: SimpleGesture | null,
  snapshot: TopologySnapshot,
): SimpleGesture | null {
  switch (action) {
    case "scenes":
      return current?.action === "recall_scene"
        ? current
        : { action: "recall_scene", targets: [] };
    case "off":
      return {
        action: "off",
        target: { rtype: "grouped_light", rid: config.group.groupedLightRid },
      };
    case "dim":
    case "toggle":
    case "on": {
      const base = gestureTarget(current) ?? config.target;
      return { action, target: targetInGroup(base, config.group, snapshot) };
    }
    default:
      return null;
  }
}

export function SimpleChannelsEditor({
  channels,
  configs,
  snapshot,
  firmware,
  dimSupported,
  openChannel,
  openGesture,
  onOpenChannel,
  onOpenGesture,
  onChange,
  onNotice,
}: {
  channels: Channel[];
  configs: SimpleChannelConfig[];
  snapshot: TopologySnapshot;
  /** False when the board runs firmware older than SIMPLE_MIN_FIRMWARE. */
  firmware: boolean;
  /** False when the board runs firmware older than SIMPLE_DIM_FIRMWARE. */
  dimSupported: boolean;
  openChannel: string | null;
  openGesture: string | null;
  onOpenChannel: (channelId: string | null) => void;
  onOpenGesture: (key: string | null) => void;
  onChange: (next: SimpleChannelConfig[]) => void;
  onNotice: (text: string | null) => void;
}) {
  // A toggle switch with "Cycle scenes" picked but no scene yet: an empty list in the draft reads as Nothing.
  const [wantsScenes, setWantsScenes] = useState<Record<string, boolean>>({});

  function patch(channelId: string, next: SimpleChannelConfig | null) {
    const without = configs.filter((config) => config.id !== channelId);
    onChange(next ? [...without, next] : without);
  }

  if (channels.length === 0) {
    return (
      <div className="border-t border-line px-5 py-4">
        <p className="text-sm text-muted">
          This board registered without channels. Re-register from the firmware
          so BOOT / D0 / D1 / D2 appear.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line">
      {!firmware ? (
        <div className="m-4 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm">
          <p className="font-medium">Update firmware to configure this switch</p>
          <p className="mt-1 text-muted">
            Channel types need Simple firmware {SIMPLE_MIN_FIRMWARE} or later.
            Until then this switch does nothing on the wall. Plug it in over USB
            and install from{" "}
            <Link href="/setup" className="text-filament underline underline-offset-2">
              Setup
            </Link>
            .
          </p>
        </div>
      ) : null}

      <fieldset disabled={!firmware} className="disabled:opacity-60">
        {channels.map((channel) => (
          <ChannelRow
            key={channel.id}
            channel={channel}
            config={configs.find((item) => item.id === channel.id)}
            snapshot={snapshot}
            dimSupported={dimSupported}
            wantsScenes={Boolean(wantsScenes[channel.id])}
            open={openChannel === channel.id}
            openGesture={openGesture}
            onToggle={() => {
              onOpenChannel(openChannel === channel.id ? null : channel.id);
              onOpenGesture(null);
            }}
            onOpenGesture={onOpenGesture}
            onWantsScenes={(value) =>
              setWantsScenes((current) => ({ ...current, [channel.id]: value }))
            }
            onPatch={(next) => patch(channel.id, next)}
            onNotice={onNotice}
          />
        ))}
      </fieldset>
    </div>
  );
}

function ChannelRow({
  channel,
  config,
  snapshot,
  dimSupported,
  wantsScenes,
  open,
  openGesture,
  onToggle,
  onOpenGesture,
  onWantsScenes,
  onPatch,
  onNotice,
}: {
  channel: Channel;
  config: SimpleChannelConfig | undefined;
  snapshot: TopologySnapshot;
  dimSupported: boolean;
  wantsScenes: boolean;
  open: boolean;
  openGesture: string | null;
  onToggle: () => void;
  onOpenGesture: (key: string | null) => void;
  onWantsScenes: (value: boolean) => void;
  onPatch: (next: SimpleChannelConfig | null) => void;
  onNotice: (text: string | null) => void;
}) {
  const boot = isBootChannel(channel.id);
  const rooms = pickableGroups(snapshot);
  const room = config ? groupRoom(snapshot, config.group) : undefined;
  const roomName = room?.name ?? "the group";
  const stale = config ? isSimpleChannelStale(config, snapshot) : false;
  const gestures = config ? channelGestures(config, snapshot, dimSupported, wantsScenes) : [];

  const headline = config ? `${room?.name ?? "Unknown group"} · ${kindLabel(config.kind)}` : "Not used";
  const subline = config
    ? gesturesLine(gestures)
    : boot
      ? "Push button. Hold re-pairs with the Bridge."
      : "Pick a room or zone to use this channel.";

  function changeGroup(roomId: string) {
    onWantsScenes(false);
    onOpenGesture(null);
    if (!roomId) {
      onPatch(null);
      return;
    }
    const group = groupFromRoomId(snapshot, roomId);
    if (!group) return;
    onPatch(config ? withGroup(config, group) : defaultSimpleChannel(channel.id, group));
  }

  function changeKind(kind: ChannelKind) {
    if (!config || config.kind === kind) return;
    onWantsScenes(false);
    onOpenGesture(null);
    onPatch(withKind(config, kind));
  }

  function setAction(slot: GestureSlot, action: GestureAction) {
    if (!config) return;
    if (config.kind === "maintained") {
      onWantsScenes(action === "scenes");
      if (action === "none") onPatch({ ...config, scenes: [] });
      return;
    }
    if (slot === "double") {
      onPatch({ ...config, double: gestureFromAction(action, config, config.double, snapshot) });
    } else if (slot === "hold") {
      onPatch({ ...config, hold: gestureFromAction(action, config, config.hold, snapshot) });
    }
  }

  function setTarget(slot: GestureSlot, target: RecipeTarget) {
    if (!config) return;
    if (slot === "primary") {
      const next = withTarget(config, target);
      onPatch(next);
      onNotice(
        next.hold === null && config.hold?.action === "off"
          ? `Hold turn off removed: Click already controls all of ${roomName}.`
          : null,
      );
      return;
    }
    const current = slot === "double" ? config.double : config.hold;
    if (!current || current.action === "recall_scene") return;
    const next: SimpleGesture = { action: current.action, target };
    onPatch(slot === "double" ? { ...config, double: next } : { ...config, hold: next });
  }

  function setScenes(slot: GestureSlot, scenes: SceneListItem[]) {
    if (!config) return;
    if (config.kind === "maintained") {
      // Removing the last scene keeps the chooser open instead of flipping to Nothing.
      onWantsScenes(true);
      onPatch({ ...config, scenes });
      return;
    }
    const next: SimpleGesture = { action: "recall_scene", targets: scenes };
    onPatch(slot === "double" ? { ...config, double: next } : { ...config, hold: next });
  }

  const notes: { text: string; warn?: boolean }[] = [];
  if (config?.kind === "maintained" && config.target.rtype === "light" && config.scenes.length > 0) {
    notes.push({ text: `Scenes apply to the whole ${config.group.rtype}, not only this light.` });
  }
  if (config?.kind === "momentary") {
    if (config.double) {
      notes.push({ text: "With a double-click set, a single click waits a moment before it acts." });
    }
    if (config.hold?.action === "dim") {
      notes.push({ text: "Hold ramps the light up or down, alternating each time. Let go to stop." });
    }
    if (!holdOffAvailable(config) && !config.hold) {
      notes.push({
        text: `Hold can turn off all of ${roomName} when Click controls a single light.`,
      });
    }
    if (boot && config.hold) {
      notes.push({
        text: "The button no longer re-pairs with the Bridge. To re-pair, reinstall over USB from Setup.",
        warn: true,
      });
    }
  }

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`grid w-full grid-cols-[84px_minmax(0,1fr)_auto] items-baseline gap-3.5 px-5 py-4 text-left ${
          open ? "bg-background" : ""
        }`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-semibold">{channel.label}</span>
          <span className="text-[11px] text-muted">GPIO {channel.gpio}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className={`text-sm font-medium ${config ? "" : "text-muted"}`}>
            {headline}
            {stale ? (
              <span className="ml-2 text-xs font-normal text-warn">Missing from snapshot</span>
            ) : null}
          </span>
          <span className="text-[13px] text-pretty text-muted">{subline}</span>
        </span>
        <span className="text-xs font-medium text-filament">
          {open ? "Close" : config ? "Edit" : "Set up"}
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-3.5 px-5 pb-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
              <span className="text-xs text-muted">Room or zone</span>
              <select
                value={config?.group.rid ?? ""}
                onChange={(event) => changeGroup(event.target.value)}
                className="rounded-md border border-line bg-cream px-2 py-[7px] text-sm outline-none focus:border-filament"
              >
                <option value="">Not used</option>
                {config && !room ? (
                  <option value={config.group.rid}>Unknown group — pick another</option>
                ) : null}
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.rtype === "zone" ? "zone" : "room"})
                  </option>
                ))}
              </select>
            </label>
            {config ? (
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className="text-xs text-muted">Type</span>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="radiogroup"
                  aria-label={`${channel.label} type`}
                >
                  {(boot
                    ? (["momentary"] as const)
                    : (["maintained", "momentary"] as const)
                  ).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={config.kind === kind}
                      onClick={() => changeKind(kind)}
                      className={choiceClass(config.kind === kind)}
                    >
                      {kindLabel(kind)}
                    </button>
                  ))}
                  {boot ? (
                    <span className="text-xs text-muted">BOOT is always a push button.</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {config
            ? gestures.map((gesture) => {
                const key = `${channel.id}:${gesture.slot}`;
                return (
                  <GesturePicker
                    key={key}
                    label={gesture.label}
                    summary={gesture.summary}
                    muted={gesture.action === "none"}
                    open={openGesture === key}
                    onToggle={() => onOpenGesture(openGesture === key ? null : key)}
                    options={gesture.options}
                    action={gesture.action}
                    onAction={(action) => setAction(gesture.slot, action)}
                    fixedTarget={gesture.fixedTarget}
                    group={config.group}
                    snapshot={snapshot}
                    target={gesture.target}
                    onTarget={(target) => setTarget(gesture.slot, target)}
                    scenes={gesture.scenes}
                    onScenes={(scenes) => setScenes(gesture.slot, scenes)}
                  />
                );
              })
            : null}

          {notes.map((note) => (
            <p key={note.text} className={`text-xs ${note.warn ? "text-warn" : "text-muted"}`}>
              {note.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
