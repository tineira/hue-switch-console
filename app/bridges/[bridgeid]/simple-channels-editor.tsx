"use client";

import { pickableGroups } from "@/lib/pages";
import {
  SIMPLE_MIN_FIRMWARE,
  confirmationForSimpleChannel,
  defaultSimpleChannel,
  groupFromRoomId,
  groupRoom,
  isBootChannel,
  isSimpleChannelStale,
  kindLabel,
  targetName,
  withGroup,
  withKind,
} from "@/lib/simple-channels";
import type {
  Channel,
  ChannelKind,
  SceneListItem,
  SimpleChannelConfig,
  SimpleHold,
  TopologySnapshot,
} from "@/lib/types";
import Link from "next/link";

export type SimpleSlot = "target" | "scenes" | "hold";
export type SimpleSlotRef = { channelId: string; slot: SimpleSlot };

type HoldChoice = "repair" | "toggle" | "on" | "off" | "recall_scene";

const HOLD_CHOICES: { value: HoldChoice; label: string }[] = [
  { value: "repair", label: "Re-pair with Bridge" },
  { value: "toggle", label: "Toggle" },
  { value: "on", label: "Turn on" },
  { value: "off", label: "Turn off" },
  { value: "recall_scene", label: "Cycle scenes" },
];

function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = [...items];
  const to = index + dir;
  if (to < 0 || to >= next.length) return items;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function SimpleChannelsEditor({
  channels,
  configs,
  snapshot,
  firmware,
  selectedSlot,
  pending,
  dirty,
  savedFlash,
  staleCount,
  onSelectSlot,
  onChange,
  onSave,
  onDiscard,
  onClearStale,
}: {
  channels: Channel[];
  configs: SimpleChannelConfig[];
  snapshot: TopologySnapshot;
  /** False when the board runs firmware older than SIMPLE_MIN_FIRMWARE. */
  firmware: boolean;
  selectedSlot: SimpleSlotRef | null;
  pending: boolean;
  dirty: boolean;
  savedFlash: boolean;
  staleCount: number;
  onSelectSlot: (slot: SimpleSlotRef) => void;
  onChange: (next: SimpleChannelConfig[]) => void;
  onSave: () => void;
  onDiscard: () => void;
  onClearStale: () => void;
}) {
  function patch(channelId: string, next: SimpleChannelConfig | null) {
    const without = configs.filter((config) => config.id !== channelId);
    onChange(next ? [...without, next] : without);
  }

  if (channels.length === 0) {
    return (
      <div className="border-t border-line px-4 py-3">
        <p className="text-sm text-muted">
          This board registered without channels. Re-register from the firmware
          so BOOT / D0 / D1 / D2 appear.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
      {!firmware ? (
        <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm">
          <p className="font-medium">Update firmware to configure this switch</p>
          <p className="mt-1 text-muted">
            Channel types need Simple firmware {SIMPLE_MIN_FIRMWARE} or later.
            Until then this switch does nothing on the wall. Plug it in over USB
            and install from{" "}
            <Link href="/devices" className="text-filament underline underline-offset-2">
              Devices
            </Link>
            .
          </p>
        </div>
      ) : null}

      <fieldset disabled={!firmware} className="flex flex-col gap-3 disabled:opacity-60">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            config={configs.find((config) => config.id === channel.id)}
            snapshot={snapshot}
            selectedSlot={selectedSlot}
            onSelectSlot={onSelectSlot}
            onPatch={(next) => patch(channel.id, next)}
          />
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 rounded-lg bg-background/70 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Confirmation
        </p>
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {channels.map((channel) => (
            <p key={channel.id}>
              {confirmationForSimpleChannel(
                channel.label,
                configs.find((config) => config.id === channel.id),
                snapshot,
              )}
            </p>
          ))}
        </div>
        {staleCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-warn">
              {staleCount} channel{staleCount === 1 ? " uses" : "s use"} lights
              or scenes missing from this snapshot. Saving will be rejected
              until {staleCount === 1 ? "it is" : "they are"} fixed.
            </p>
            <button
              type="button"
              onClick={onClearStale}
              className="text-xs font-medium text-warn hover:underline"
            >
              Clear stale
            </button>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-cream/95 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || pending || !firmware}
          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save channels"}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Discard
        </button>
        {!dirty && savedFlash ? <span className="text-xs text-ok">Saved</span> : null}
        {dirty ? <span className="text-xs text-filament">Unsaved changes</span> : null}
        {!dirty && !savedFlash ? (
          <span className="text-xs text-muted">Channels without a room do nothing.</span>
        ) : null}
      </div>
    </div>
  );
}

function ChannelCard({
  channel,
  config,
  snapshot,
  selectedSlot,
  onSelectSlot,
  onPatch,
}: {
  channel: Channel;
  config: SimpleChannelConfig | undefined;
  snapshot: TopologySnapshot;
  selectedSlot: SimpleSlotRef | null;
  onSelectSlot: (slot: SimpleSlotRef) => void;
  onPatch: (next: SimpleChannelConfig | null) => void;
}) {
  const boot = isBootChannel(channel.id);
  const rooms = pickableGroups(snapshot);
  const groupRid = config?.group.rid ?? "";
  const groupMissing = config ? !groupRoom(snapshot, config.group) : false;
  const stale = config ? isSimpleChannelStale(config, snapshot) : false;
  const isSelected = (slot: SimpleSlot) =>
    selectedSlot?.channelId === channel.id && selectedSlot.slot === slot;

  function changeGroup(roomId: string) {
    if (!roomId) {
      onPatch(null);
      return;
    }
    const group = groupFromRoomId(snapshot, roomId);
    if (!group) return;
    onPatch(config ? withGroup(config, group) : defaultSimpleChannel(channel.id, group));
    onSelectSlot({ channelId: channel.id, slot: "target" });
  }

  return (
    <div
      className={`flex flex-col gap-2.5 border-l-2 pl-3 ${
        config ? "border-filament/70" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {channel.label}
          <span className="ml-2 text-xs font-normal text-muted">GPIO {channel.gpio}</span>
        </p>
        {stale ? <span className="text-xs text-warn">Missing from snapshot</span> : null}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Room or zone
        </span>
        <select
          value={groupRid}
          onChange={(event) => changeGroup(event.target.value)}
          className="rounded-md border border-line bg-cream px-2 py-1.5 text-sm outline-none focus:border-filament"
        >
          <option value="">Not used</option>
          {groupMissing && config ? (
            <option value={config.group.rid}>Unknown group — pick another</option>
          ) : null}
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} ({room.rtype === "zone" ? "zone" : "room"})
            </option>
          ))}
        </select>
      </label>

      {config ? (
        <>
          <KindPicker
            channelId={channel.id}
            kind={config.kind}
            locked={boot}
            onChange={(kind) => onPatch(withKind(config, kind))}
          />

          <SlotRow
            label={config.kind === "maintained" ? "On / Off" : "Click"}
            selected={isSelected("target")}
            onSelect={() => onSelectSlot({ channelId: channel.id, slot: "target" })}
          >
            {config.kind === "maintained"
              ? `Lever up turns on, down turns off ${targetName(config.target, config.group, snapshot)}`
              : `Toggles ${targetName(config.target, config.group, snapshot)}`}
          </SlotRow>

          {config.kind === "maintained" ? (
            <SceneSlot
              label="Double-click"
              emptyText="Empty — double-click turns the target on"
              scenes={config.scenes}
              selected={isSelected("scenes")}
              onSelect={() => onSelectSlot({ channelId: channel.id, slot: "scenes" })}
              onChange={(scenes) => onPatch({ ...config, scenes })}
            />
          ) : null}

          {config.kind === "maintained" &&
          config.target.rtype === "light" &&
          config.scenes.length > 0 ? (
            <p className="text-xs text-warn">
              Scenes apply to the whole {config.group.rtype}, not only this light.
            </p>
          ) : null}

          {config.kind === "momentary" && !boot ? (
            <p className="text-xs text-muted">Double-click and hold are not available yet.</p>
          ) : null}

          {boot ? (
            <HoldSettings
              config={config}
              snapshot={snapshot}
              selected={isSelected("hold")}
              onSelect={() => onSelectSlot({ channelId: channel.id, slot: "hold" })}
              onChange={(hold) => onPatch({ ...config, hold })}
            />
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted">
          {boot
            ? "BOOT is a push button. Hold re-pairs with the Bridge."
            : "Pick a room or zone to use this channel."}
        </p>
      )}
    </div>
  );
}

function KindPicker({
  channelId,
  kind,
  locked,
  onChange,
}: {
  channelId: string;
  kind: ChannelKind;
  locked: boolean;
  onChange: (kind: ChannelKind) => void;
}) {
  const options: ChannelKind[] = locked ? ["momentary"] : ["maintained", "momentary"];
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`${channelId} type`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        Type
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => onChange(option)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              kind === option
                ? "border-filament bg-filament-soft"
                : "border-line hover:border-filament/50"
            }`}
          >
            {kindLabel(option)}
          </button>
        ))}
        {locked ? (
          <span className="self-center text-xs text-muted">BOOT is always a push button.</span>
        ) : null}
      </div>
    </div>
  );
}

function SlotRow({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left ${
        selected ? "border-filament bg-filament-soft" : "border-line bg-background/40"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className="text-sm">{children}</span>
    </button>
  );
}

function SceneSlot({
  label,
  emptyText,
  scenes,
  selected,
  onSelect,
  onChange,
}: {
  label: string;
  emptyText: string;
  scenes: SceneListItem[];
  selected: boolean;
  onSelect: () => void;
  onChange: (scenes: SceneListItem[]) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 ${
        selected
          ? "border-filament bg-filament-soft"
          : scenes.length > 0
            ? "border-line bg-background/40"
            : "border-dashed border-line"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex flex-col items-start gap-0.5 text-left">
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className={`text-sm ${scenes.length === 0 ? "text-muted" : ""}`}>
          {scenes.length === 0
            ? emptyText
            : scenes.length === 1
              ? "Recalls one scene"
              : `Cycles ${scenes.length} scenes in this order`}
        </span>
      </button>
      {scenes.length > 0 ? (
        <ol className="flex flex-col gap-1">
          {scenes.map((scene, index) => (
            <li key={scene.rid} className="flex items-center gap-1 text-sm">
              <span className="w-5 text-xs text-muted">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{scene.name || "Unknown scene"}</span>
              <button
                type="button"
                aria-label={`Move ${scene.name} up`}
                disabled={index === 0}
                onClick={() => onChange(moveItem(scenes, index, -1))}
                className="rounded px-1.5 text-xs text-muted hover:text-filament disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${scene.name} down`}
                disabled={index === scenes.length - 1}
                onClick={() => onChange(moveItem(scenes, index, 1))}
                className="rounded px-1.5 text-xs text-muted hover:text-filament disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(scenes.filter((item) => item.rid !== scene.rid))}
                className="rounded px-1.5 text-xs text-muted hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function HoldSettings({
  config,
  snapshot,
  selected,
  onSelect,
  onChange,
}: {
  config: SimpleChannelConfig;
  snapshot: TopologySnapshot;
  selected: boolean;
  onSelect: () => void;
  onChange: (hold: SimpleHold | null) => void;
}) {
  const choice: HoldChoice = config.hold ? config.hold.action : "repair";

  function pick(next: HoldChoice) {
    if (next === "repair") {
      onChange(null);
      return;
    }
    if (next === "recall_scene") {
      // An empty list is not a valid hold; the user fills it from the scene list on the right.
      onChange(
        config.hold?.action === "recall_scene"
          ? config.hold
          : { action: "recall_scene", targets: [] },
      );
      onSelect();
      return;
    }
    const target =
      config.hold && config.hold.action !== "recall_scene"
        ? config.hold.target
        : config.target;
    onChange({ action: next, target });
    onSelect();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Hold
        </span>
        <select
          value={choice}
          onChange={(event) => pick(event.target.value as HoldChoice)}
          className="rounded-md border border-line bg-cream px-2 py-1.5 text-sm outline-none focus:border-filament"
        >
          {HOLD_CHOICES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {config.hold?.action === "recall_scene" ? (
        <SceneSlot
          label="Hold scenes"
          emptyText="Pick at least one scene on the right"
          scenes={config.hold.targets}
          selected={selected}
          onSelect={onSelect}
          onChange={(targets) => onChange({ action: "recall_scene", targets })}
        />
      ) : config.hold ? (
        <SlotRow label="Hold target" selected={selected} onSelect={onSelect}>
          {targetName(config.hold.target, config.group, snapshot)}
        </SlotRow>
      ) : null}
      {config.hold ? (
        <p className="text-xs text-warn">
          The button no longer re-pairs with the Bridge. To re-pair, reinstall
          over USB from Devices.
        </p>
      ) : null}
    </div>
  );
}
