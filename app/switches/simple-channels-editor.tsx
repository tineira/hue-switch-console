"use client";

// The Simple editor on Switches: the board picture, the switches the user wired (BOOT first),
// an add flow, and one editor for the selected switch. Spec: docs/specs/simple-editor-v2.md.

import {
  GesturePicker,
  choiceClass,
  type GestureOption,
} from "@/app/switches/gesture-picker";
import { RoomGrid } from "@/app/switches/room-grid";
import { SimpleBoard, type BoardPin, type PadState } from "@/app/switches/simple-board";
import {
  gestureTarget,
  simpleChannelGestures,
  targetInGroup,
  type GestureAction,
  type GestureSlot,
  type GestureSummary,
} from "@/lib/gestures";
import { pageGroupFromRoom, pickableGroups } from "@/lib/pages";
import {
  BOOT_CHANNEL_ID,
  SIMPLE_LABEL_MAX,
  SIMPLE_MIN_FIRMWARE,
  defaultSimpleChannel,
  groupFromRoomId,
  groupRoom,
  holdOffAvailable,
  isBootChannel,
  isSimpleChannelStale,
  kindLabel,
  withChannelId,
  withGroup,
  withKind,
  withTarget,
} from "@/lib/simple-channels";
import type {
  Channel,
  ChannelKind,
  RecipeTarget,
  Room,
  SceneListItem,
  SimpleChannelConfig,
  SimpleGesture,
  TopologySnapshot,
} from "@/lib/types";
import Link from "next/link";
import { useState, type ReactNode } from "react";

type GestureView = GestureSummary & {
  options?: GestureOption[];
  fixedTarget?: boolean;
};

type Adding = { kind: ChannelKind | null; pin: string | null };

const SCENE_OPTIONS: GestureOption[] = [
  { value: "none", label: "Nothing" },
  { value: "scenes", label: "Cycle scenes" },
];

const KIND_TEXT: Record<ChannelKind, string> = {
  maintained: "A lever that stays up or down.",
  momentary: "A button that springs back.",
};

const BOOT_REPAIR_SUMMARY = "Re-pairs with the Bridge (hold 3 s)";

/** The gesture cards a configured switch shows, with their summaries and choices. */
function channelGestures(
  config: SimpleChannelConfig,
  snapshot: TopologySnapshot,
  wantsScenes: boolean,
): GestureView[] {
  const boot = isBootChannel(config.id);
  const roomName = groupRoom(snapshot, config.group)?.name ?? "the group";
  return simpleChannelGestures(config, snapshot, wantsScenes).map((gesture) => {
    if (gesture.slot === "double") return { ...gesture, options: SCENE_OPTIONS };
    if (gesture.slot !== "hold") return gesture;
    // BOOT's Hold is the one that competes with re-pairing: nothing set means re-pair.
    const holdOptions: GestureOption[] = [
      { value: "none", label: boot ? "Re-pair with the Bridge" : "Nothing" },
      { value: "dim", label: "Dim" },
    ];
    if (holdOffAvailable(config) || gesture.action === "off") {
      holdOptions.push({ value: "off", label: `Turn off all of ${roomName}` });
    }
    return {
      ...gesture,
      summary: boot && gesture.action === "none" ? BOOT_REPAIR_SUMMARY : gesture.summary,
      options: holdOptions,
      // Turn off is the whole group; Dim follows Click. Neither offers light chips.
      fixedTarget: gesture.action === "off" || gesture.action === "dim",
    };
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
      // Dim dims what Click controls; it has no target of its own.
      return { action: "dim", target: config.target };
    case "toggle":
    case "on": {
      const base = gestureTarget(current) ?? config.target;
      return { action, target: targetInGroup(base, config.group, snapshot) };
    }
    default:
      return null;
  }
}

/** What the notice says after the type changes (`withKind` keeps a scene list, drops hold). */
function kindNotice(before: SimpleChannelConfig, kind: ChannelKind): string {
  if (kind === "momentary") {
    return before.scenes.length > 0
      ? "Now a push button: the double-click scenes moved over."
      : "Now a push button: Click toggles; Double-click and Hold do nothing yet.";
  }
  const parts: string[] = [];
  if (before.double?.action === "recall_scene") parts.push("double-click scenes kept");
  if (before.hold) parts.push("hold cleared");
  return `Now a wall switch${parts.length ? `: ${parts.join("; ")}` : ""}.`;
}

function switchName(config: SimpleChannelConfig, snapshot: TopologySnapshot): string {
  const label = config.label?.trim();
  if (label) return label;
  const room = groupRoom(snapshot, config.group)?.name ?? "Unknown group";
  return isBootChannel(config.id) ? `BOOT · ${room}` : `${room} · ${kindLabel(config.kind)}`;
}

export function SimpleChannelsEditor({
  mac,
  channels,
  configs,
  snapshot,
  firmware,
  openGesture,
  onOpenGesture,
  onChange,
  onNotice,
}: {
  mac: string;
  channels: Channel[];
  configs: SimpleChannelConfig[];
  snapshot: TopologySnapshot;
  /** False when the board runs firmware older than SIMPLE_MIN_FIRMWARE. */
  firmware: boolean;
  openGesture: string | null;
  onOpenGesture: (key: string | null) => void;
  onChange: (next: SimpleChannelConfig[]) => void;
  onNotice: (text: string | null) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [wiredOpen, setWiredOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // A switch with "Cycle scenes" picked but no scene yet: an empty list in the draft reads as Nothing.
  const [wantsScenes, setWantsScenes] = useState<Record<string, boolean>>({});

  const pins = channels.filter((channel) => !isBootChannel(channel.id));
  const bootRegistered = channels.some((channel) => isBootChannel(channel.id));
  const configFor = (id: string) => configs.find((config) => config.id === id);
  const bootConfig = configFor(BOOT_CHANNEL_ID);
  const wired = pins.flatMap((pin) => {
    const config = configFor(pin.id);
    return config ? [config] : [];
  });
  const freePins = pins.filter((pin) => !configFor(pin.id));
  const numberOf = (id: string) => wired.findIndex((config) => config.id === id) + 1;

  // The picked switch while it exists; otherwise the first wired one, else BOOT.
  const selected =
    picked && ((isBootChannel(picked) && bootRegistered) || configFor(picked))
      ? picked
      : (wired[0]?.id ?? (bootRegistered ? BOOT_CHANNEL_ID : null));
  const selectedConfig = selected ? configFor(selected) : undefined;

  if (channels.length === 0) {
    return (
      <div className="border-t border-line px-5 py-4">
        <p className="text-sm text-muted">
          This board registered without channels. Re-register from the firmware
          so BOOT and its D pins (D0–D5 on current firmware) appear.
        </p>
      </div>
    );
  }

  if (!firmware) {
    return (
      <div className="border-t border-line px-5 py-4">
        <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm">
          <p className="font-medium">Update this switch to set it up</p>
          <p className="mt-1 text-muted">
            It needs Simple firmware {SIMPLE_MIN_FIRMWARE} or later. Until then it does
            nothing on the wall. Plug it in over USB and install from{" "}
            <Link href={`/setup?mac=${mac}`} className="text-filament underline underline-offset-2">
              Setup
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  function select(id: string) {
    setPicked(id);
    setAdding(null);
    setWiredOpen(false);
    setConfirmRemove(false);
    onOpenGesture(null);
  }

  function startAdd(pin: string | null = null) {
    setAdding({ kind: null, pin: pin ?? (freePins.length === 1 ? freePins[0].id : null) });
    setWiredOpen(false);
    setConfirmRemove(false);
    onOpenGesture(null);
    onNotice(null);
  }

  /** Replace the settings stored under `id` (or drop them with null). */
  function patch(id: string, next: SimpleChannelConfig | null) {
    const without = configs.filter((config) => config.id !== id);
    onChange(next ? [...without, next] : without);
  }

  function pickOnBoard(id: string) {
    if (isBootChannel(id) || configFor(id)) select(id);
    else startAdd(id);
  }

  function createFromRoom(id: string, kind: ChannelKind, room: Room) {
    const group = pageGroupFromRoom(room);
    if (!group) return;
    patch(id, { ...defaultSimpleChannel(id, group), kind });
    select(id);
  }

  const padState = (id: string): PadState =>
    (adding ? adding.pin === id : selected === id) ? "selected" : configFor(id) ? "used" : "free";

  const boardPins: BoardPin[] = pins.map((pin) => {
    const config = configFor(pin.id);
    return {
      id: pin.id,
      label: pin.label,
      state: padState(pin.id),
      number: config ? numberOf(pin.id) : undefined,
      title: config
        ? `${pin.label}: ${switchName(config, snapshot)}`
        : `${pin.label} is free. Click to add a switch here.`,
    };
  });

  return (
    <div className="border-t border-line">
      <div className="flex flex-wrap">
        <div className="flex max-w-full flex-[1_1_380px] flex-col gap-5 bg-background px-6 py-7">
          <SimpleBoard
            pins={boardPins}
            boot={
              bootRegistered
                ? {
                    state: !adding && selected === BOOT_CHANNEL_ID ? "selected" : bootConfig ? "used" : "free",
                    title: bootConfig
                      ? `BOOT: ${switchName(bootConfig, snapshot)}`
                      : "BOOT, the button on the board. Click to set it up.",
                  }
                : null
            }
            onPick={pickOnBoard}
          />

          <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Switches
              </span>
              <span className="text-xs text-muted">
                {wired.length} of {pins.length} pins
              </span>
            </div>

            {bootRegistered ? (
              <ListRow
                badge="B"
                ghost={!bootConfig}
                name={bootConfig ? switchName(bootConfig, snapshot) : "BOOT button"}
                sub={
                  bootConfig
                    ? `${bootConfig.label?.trim() ? `${groupRoom(snapshot, bootConfig.group)?.name ?? "Unknown group"} · ` : ""}On the board · push button`
                    : "On the board · set it up to test"
                }
                pin="BOOT"
                current={!adding && selected === BOOT_CHANNEL_ID}
                stale={bootConfig ? isSimpleChannelStale(bootConfig, snapshot) : false}
                onClick={() => select(BOOT_CHANNEL_ID)}
              />
            ) : null}

            {wired.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted">Nothing wired yet.</p>
            ) : (
              wired.map((config) => {
                const pin = pins.find((item) => item.id === config.id);
                return (
                  <ListRow
                    key={config.id}
                    badge={String(numberOf(config.id))}
                    name={switchName(config, snapshot)}
                    sub={`${config.label?.trim() ? `${groupRoom(snapshot, config.group)?.name ?? "Unknown group"} · ` : ""}${kindLabel(config.kind)}`}
                    pin={pin?.label ?? config.id}
                    current={!adding && selected === config.id}
                    stale={isSimpleChannelStale(config, snapshot)}
                    onClick={() => select(config.id)}
                  />
                );
              })
            )}

            {freePins.length > 0 ? (
              <button
                type="button"
                onClick={() => startAdd()}
                className="flex w-full items-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-line px-2.5 py-2 text-sm font-medium text-filament hover:border-filament"
              >
                <span className="text-lg leading-none">+</span> Add a switch
              </button>
            ) : (
              <p className="text-xs text-muted">All {pins.length} pins are in use.</p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-5 p-6">
          {adding ? (
            <AddFlow
              adding={adding}
              freePins={freePins}
              snapshot={snapshot}
              onKind={(kind) => setAdding({ ...adding, kind })}
              onPin={(pin) => setAdding({ ...adding, pin })}
              onRoom={(room) => {
                if (!adding.kind || !adding.pin) return;
                const pin = pins.find((item) => item.id === adding.pin);
                createFromRoom(adding.pin, adding.kind, room);
                onNotice(
                  `Added ${kindLabel(adding.kind).toLowerCase()} on ${pin?.label ?? adding.pin}. Name it so you can tell switches apart.`,
                );
              }}
              onCancel={() => setAdding(null)}
            />
          ) : selected && isBootChannel(selected) && !bootConfig ? (
            <BootSetup
              first={wired.length === 0}
              canAdd={freePins.length > 0}
              snapshot={snapshot}
              onRoom={(room) => {
                createFromRoom(BOOT_CHANNEL_ID, "momentary", room);
                onNotice(`BOOT now toggles ${room.name}. Save, then press BOOT on the board to test.`);
              }}
              onAdd={() => startAdd()}
            />
          ) : selectedConfig ? (
            <SwitchEditor
              key={selectedConfig.id}
              config={selectedConfig}
              pin={pins.find((item) => item.id === selectedConfig.id) ?? null}
              freePins={freePins}
              snapshot={snapshot}
              wantsScenes={Boolean(wantsScenes[selectedConfig.id])}
              onWantsScenes={(value) =>
                setWantsScenes((current) => ({ ...current, [selectedConfig.id]: value }))
              }
              openGesture={openGesture}
              onOpenGesture={onOpenGesture}
              wiredOpen={wiredOpen}
              onWiredOpen={setWiredOpen}
              confirmRemove={confirmRemove}
              onConfirmRemove={setConfirmRemove}
              onPatch={(next) => patch(selectedConfig.id, next)}
              onMove={(pinId) => {
                const from = pins.find((item) => item.id === selectedConfig.id)?.label;
                const to = pins.find((item) => item.id === pinId)?.label;
                onChange([
                  ...configs.filter((config) => config.id !== selectedConfig.id),
                  withChannelId(selectedConfig, pinId),
                ]);
                select(pinId);
                onNotice(`Moved from ${from} to ${to}.`);
              }}
              onRemove={() => {
                const boot = isBootChannel(selectedConfig.id);
                const name = switchName(selectedConfig, snapshot);
                const pinLabel = pins.find((item) => item.id === selectedConfig.id)?.label ?? selectedConfig.id;
                patch(selectedConfig.id, null);
                setConfirmRemove(false);
                onOpenGesture(null);
                if (!boot) setPicked(null);
                onNotice(
                  boot
                    ? "Cleared BOOT. Holding it re-pairs with the Bridge again."
                    : `Removed ${name}. ${pinLabel} is free.`,
                );
              }}
              onNotice={onNotice}
            />
          ) : (
            <p className="text-sm text-muted">Pick a switch on the left, or add one.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({
  badge,
  ghost = false,
  name,
  sub,
  pin,
  current,
  stale,
  onClick,
}: {
  badge: string;
  ghost?: boolean;
  name: string;
  sub: string;
  pin: string;
  current: boolean;
  stale: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left ${
        current
          ? "border-filament bg-filament-soft shadow-[0_0_0_1px_var(--filament)]"
          : "border-line bg-cream hover:border-filament/50"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-semibold ${
          ghost ? "border-[1.5px] border-dashed border-line text-muted" : "bg-filament text-filament-ink"
        }`}
      >
        {badge}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {stale ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-warn"
              aria-label="Not on the Bridge anymore"
              title="Not on the Bridge anymore"
            />
          ) : null}
        </span>
        <span className="truncate text-xs text-muted">{stale ? "Not on the Bridge anymore" : sub}</span>
      </span>
      <span className="font-mono text-xs text-muted">{pin}</span>
    </button>
  );
}

function KindArt({ kind }: { kind: ChannelKind }) {
  if (kind === "maintained") {
    return (
      <svg width="44" height="54" viewBox="0 0 44 54" aria-hidden="true" className="shrink-0">
        <rect x="4" y="2" width="36" height="50" rx="6" fill="var(--cream)" stroke="var(--muted)" strokeWidth="1.5" />
        <rect x="15" y="10" width="14" height="34" rx="4" fill="var(--line)" />
        <rect x="16" y="11" width="12" height="16" rx="3" fill="var(--filament)" />
      </svg>
    );
  }
  return (
    <svg width="44" height="54" viewBox="0 0 44 54" aria-hidden="true" className="shrink-0">
      <rect x="4" y="5" width="36" height="44" rx="6" fill="var(--cream)" stroke="var(--muted)" strokeWidth="1.5" />
      <circle cx="22" cy="27" r="11" fill="var(--line)" />
      <circle cx="22" cy="27" r="7.5" fill="var(--filament)" />
    </svg>
  );
}

function KindIcon({ kind }: { kind: ChannelKind }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {kind === "maintained" ? (
        <>
          <rect x="6" y="3" width="12" height="18" rx="2.5" />
          <rect x="9.5" y="6" width="5" height="7" rx="1.2" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

function KindCards({
  value,
  onPick,
}: {
  value: ChannelKind | null;
  onPick: (kind: ChannelKind) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5" role="radiogroup" aria-label="What is wired">
      {(["maintained", "momentary"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          onClick={() => onPick(kind)}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left ${
            value === kind
              ? "border-filament bg-filament-soft shadow-[0_0_0_1px_var(--filament)]"
              : "border-line bg-background hover:border-filament"
          }`}
        >
          <KindArt kind={kind} />
          <span className="flex flex-col">
            <span className="font-semibold">{kindLabel(kind)}</span>
            <span className="text-xs text-muted">{KIND_TEXT[kind]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function PinChip({ pin, selected, onClick }: { pin: Channel; selected: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={choiceClass(selected)}>
      <span className="font-mono">{pin.label}</span>{" "}
      <span className="text-xs text-muted">· GPIO {pin.gpio}</span>
    </button>
  );
}

function Step({
  n,
  title,
  done = false,
  later = false,
  children,
}: {
  n: number | null;
  title: string;
  done?: boolean;
  later?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2.5 ${later ? "pointer-events-none opacity-45" : ""}`}>
      <h4 className="flex items-center gap-2 text-[13px] font-semibold">
        {n !== null ? (
          <span
            className={`inline-grid h-5 w-5 place-items-center rounded-full text-[11px] ${
              done ? "bg-filament text-filament-ink" : "bg-line"
            }`}
          >
            {n}
          </span>
        ) : null}
        {title}
      </h4>
      {children}
    </div>
  );
}

function AddFlow({
  adding,
  freePins,
  snapshot,
  onKind,
  onPin,
  onRoom,
  onCancel,
}: {
  adding: Adding;
  freePins: Channel[];
  snapshot: TopologySnapshot;
  onKind: (kind: ChannelKind) => void;
  onPin: (pin: string) => void;
  onRoom: (room: Room) => void;
  onCancel: () => void;
}) {
  const askPin = freePins.length > 1;
  const ready = Boolean(adding.kind && adding.pin);
  return (
    <>
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.01em]">Add a switch</h3>
        <p className="mt-1 text-sm text-pretty text-muted">Tell the console what you connected to the board.</p>
      </div>
      <Step n={1} title="What did you wire?" done={Boolean(adding.kind)}>
        <KindCards value={adding.kind} onPick={onKind} />
      </Step>
      {askPin ? (
        <Step n={2} title="Which pin is it on?" done={Boolean(adding.pin)} later={!adding.kind}>
          <div className="flex flex-wrap gap-1.5">
            {freePins.map((pin) => (
              <PinChip key={pin.id} pin={pin} selected={adding.pin === pin.id} onClick={() => onPin(pin.id)} />
            ))}
          </div>
        </Step>
      ) : null}
      <Step n={askPin ? 3 : 2} title="Which room or zone does it control?" later={!ready}>
        <RoomGrid snapshot={snapshot} onPick={onRoom} empty="No rooms or zones in this snapshot. A switch needs a Hue group." />
        <p className="text-xs text-muted">
          {adding.kind === "momentary"
            ? "Click will toggle the whole group. You can change it after."
            : "Up turns the whole group on, down turns it off. You can change it after."}
        </p>
      </Step>
      <button type="button" onClick={onCancel} className="self-start text-xs text-muted hover:text-foreground">
        Cancel
      </button>
    </>
  );
}

// BOOT before it has a room: the first thing to try, before anything is wired.
function BootSetup({
  first,
  canAdd,
  snapshot,
  onRoom,
  onAdd,
}: {
  first: boolean;
  canAdd: boolean;
  snapshot: TopologySnapshot;
  onRoom: (room: Room) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.01em]">
          {first ? "Start with the BOOT button" : "BOOT button"}
        </h3>
        <p className="mt-1 text-sm text-pretty text-muted">
          The small button on the board. Use it to check that everything works before
          you wire anything: pick a room, save, then press BOOT.
        </p>
      </div>
      <Step n={null} title="Which room or zone should BOOT control?">
        <RoomGrid snapshot={snapshot} onPick={onRoom} empty="No rooms or zones in this snapshot. BOOT needs a Hue group." />
        <p className="text-xs text-muted">
          Click will toggle the whole group. Holding BOOT for 3 s still re-pairs with the
          Bridge unless you change Hold.
        </p>
      </Step>
      {first && canAdd ? (
        <button type="button" onClick={onAdd} className="self-start text-xs font-medium text-filament">
          Or add a wired switch
        </button>
      ) : null}
    </>
  );
}

function SwitchEditor({
  config,
  pin,
  freePins,
  snapshot,
  wantsScenes,
  onWantsScenes,
  openGesture,
  onOpenGesture,
  wiredOpen,
  onWiredOpen,
  confirmRemove,
  onConfirmRemove,
  onPatch,
  onMove,
  onRemove,
  onNotice,
}: {
  config: SimpleChannelConfig;
  /** The pin this switch is on; null for BOOT. */
  pin: Channel | null;
  freePins: Channel[];
  snapshot: TopologySnapshot;
  wantsScenes: boolean;
  onWantsScenes: (value: boolean) => void;
  openGesture: string | null;
  onOpenGesture: (key: string | null) => void;
  wiredOpen: boolean;
  onWiredOpen: (open: boolean) => void;
  confirmRemove: boolean;
  onConfirmRemove: (open: boolean) => void;
  onPatch: (next: SimpleChannelConfig) => void;
  onMove: (pinId: string) => void;
  onRemove: () => void;
  onNotice: (text: string | null) => void;
}) {
  const boot = isBootChannel(config.id);
  const rooms = pickableGroups(snapshot);
  const room = groupRoom(snapshot, config.group);
  const roomName = room?.name ?? "the group";
  const gestures = channelGestures(config, snapshot, wantsScenes);

  function changeGroup(roomId: string) {
    const group = groupFromRoomId(snapshot, roomId);
    if (!group || group.rid === config.group.rid) return;
    onWantsScenes(false);
    onOpenGesture(null);
    onPatch(withGroup(config, group));
    onNotice(`Gestures reset for ${groupRoom(snapshot, group)?.name ?? "the new group"}.`);
  }

  function changeKind(kind: ChannelKind) {
    if (config.kind === kind) return;
    onWantsScenes(false);
    onOpenGesture(null);
    onPatch(withKind(config, kind));
    onNotice(kindNotice(config, kind));
  }

  function setAction(slot: GestureSlot, action: GestureAction) {
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
  if (boot && config.hold) {
    notes.push({
      text: "BOOT no longer re-pairs with the Bridge. To re-pair, set Hold back to Re-pair, or reinstall over USB from Setup.",
      warn: true,
    });
  }
  if (config.kind === "maintained" && config.target.rtype === "light" && config.scenes.length > 0) {
    notes.push({ text: `Scenes apply to the whole ${config.group.rtype}, not only this light.` });
  }
  if (config.kind === "momentary") {
    if (config.double) {
      notes.push({ text: "With a double-click set, a single click waits a moment before it acts." });
    }
    if (config.hold?.action === "dim") {
      notes.push({
        text: "Hold dims whatever Click controls, up or down, alternating each time. Let go to stop.",
      });
    }
    if (!boot && !holdOffAvailable(config) && !config.hold) {
      notes.push({ text: `Hold can turn off all of ${roomName} when Click controls a single light.` });
    }
  }

  // "Remove Front door": the switch by name, so it is clear the board stays.
  const name = switchName(config, snapshot);
  const pinLabel = pin?.label ?? config.id;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
          <span className="text-xs text-muted">
            Name{" "}
            <span className="font-mono">
              · {(config.label ?? "").length}/{SIMPLE_LABEL_MAX}
            </span>
          </span>
          <input
            value={config.label ?? ""}
            maxLength={SIMPLE_LABEL_MAX}
            placeholder={room?.name ?? "Name this switch"}
            onChange={(event) => onPatch({ ...config, label: event.target.value || null })}
            onBlur={(event) => onPatch({ ...config, label: event.target.value.trim() || null })}
            className="w-full border-b border-line bg-transparent pb-1.5 pt-0.5 text-xl font-semibold tracking-[-0.01em] outline-none placeholder:font-medium placeholder:text-muted focus:border-filament"
          />
        </label>
        <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
          <span className="text-xs text-muted">Room or zone</span>
          <select
            value={config.group.rid}
            onChange={(event) => changeGroup(event.target.value)}
            className="rounded-md border border-line bg-cream px-2 py-[7px] text-sm outline-none focus:border-filament"
          >
            {!room ? <option value={config.group.rid}>Unknown group — pick another</option> : null}
            {rooms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.rtype === "zone" ? "zone" : "room"})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        {boot ? (
          <div className="flex w-full flex-wrap items-baseline gap-x-3.5 gap-y-1 rounded-[10px] border border-line px-4 py-3">
            <span className="w-[88px] shrink-0 text-xs font-medium text-muted">Wired as</span>
            <span className="flex flex-[1_1_200px] items-center gap-2 text-sm">
              <KindIcon kind="momentary" /> Push button · the BOOT button on the board
            </span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onWiredOpen(!wiredOpen)}
              aria-expanded={wiredOpen}
              className={`flex w-full flex-wrap items-baseline gap-x-3.5 gap-y-1 rounded-[10px] border px-4 py-3 text-left ${
                wiredOpen ? "border-filament bg-background" : "border-line"
              }`}
            >
              <span className="w-[88px] shrink-0 text-xs font-medium text-muted">Wired as</span>
              <span className="flex flex-[1_1_200px] items-center gap-2 text-sm">
                <KindIcon kind={config.kind} /> {kindLabel(config.kind)} on{" "}
                <span className="font-mono">{pin?.label ?? config.id}</span>
              </span>
              <span className="text-xs font-medium text-filament">{wiredOpen ? "Done" : "Change"}</span>
            </button>
            {wiredOpen ? (
              <div className="flex flex-col gap-3 px-1 pb-1 pt-3.5">
                <KindCards value={config.kind} onPick={changeKind} />
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted">
                    Pin{freePins.length > 0 ? " (move it if you rewired)" : ""}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {pin ? <PinChip pin={pin} selected /> : null}
                    {freePins.map((item) => (
                      <PinChip key={item.id} pin={item} selected={false} onClick={() => onMove(item.id)} />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {gestures.map((gesture) => {
          const key = `${config.id}:${gesture.slot}`;
          const bootRepair = boot && gesture.slot === "hold" && gesture.action === "none";
          return (
            <GesturePicker
              key={key}
              label={gesture.label}
              summary={gesture.summary}
              muted={gesture.action === "none" && !bootRepair}
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
        })}
      </div>

      {notes.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {notes.map((note) => (
            <p key={note.text} className={`text-xs ${note.warn ? "text-warn" : "text-muted"}`}>
              {note.text}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {confirmRemove ? (
          <>
            <span className="text-danger">
              {boot
                ? "Clear BOOT's settings? Hold goes back to re-pairing with the Bridge."
                : `Remove ${name}? ${pinLabel} becomes free and does nothing until you add a switch there.`}
            </span>
            <button type="button" onClick={onRemove} className="font-medium text-danger">
              {boot ? "Clear" : "Remove"}
            </button>
            <button type="button" onClick={() => onConfirmRemove(false)} className="font-medium">
              Keep
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onConfirmRemove(true)} className="text-muted hover:text-danger">
            {boot ? "Clear BOOT settings" : `Remove ${name}`}
          </button>
        )}
      </div>
    </>
  );
}
