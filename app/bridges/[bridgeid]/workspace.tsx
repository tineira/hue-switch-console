"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  actionLabel,
  actionsForTarget,
  actionClause,
  confirmationForChannel,
  defaultActionForTarget,
  eventLabel,
  eventsForKind,
  groupTopology,
  isTargetStale,
  kindLabel,
  nameForTarget,
  recipesEqual,
} from "@/lib/recipes";
import { formatMac } from "@/lib/mac";
import type {
  Channel,
  ChannelEvent,
  HueAction,
  Recipe,
  RecipeTarget,
  SwitchPublic,
  TopologySnapshot,
} from "@/lib/types";

export type WorkspaceSwitch = SwitchPublic & { recipes: Recipe[] };

type SlotRef = { channelId: string; event: ChannelEvent };

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} h ago`;
  return new Date(iso).toLocaleString();
}

function findRecipe(
  recipes: Recipe[],
  slot: SlotRef,
): Recipe | undefined {
  return recipes.find(
    (recipe) =>
      recipe.channelId === slot.channelId && recipe.event === slot.event,
  );
}

function upsertRecipe(recipes: Recipe[], next: Recipe): Recipe[] {
  const without = recipes.filter(
    (recipe) =>
      !(recipe.channelId === next.channelId && recipe.event === next.event),
  );
  return [...without, next];
}

function clearRecipe(recipes: Recipe[], slot: SlotRef): Recipe[] {
  return recipes.filter(
    (recipe) =>
      !(recipe.channelId === slot.channelId && recipe.event === slot.event),
  );
}

function incompatibleHint(event: ChannelEvent): string {
  if (event === "double_click") {
    return "Double-click can take a scene, a room, or a light.";
  }
  return `${eventLabel(event)} cannot target a scene. Pick a room or a light.`;
}

function firstOpenSlot(
  item: WorkspaceSwitch | undefined,
  recipes: Recipe[],
): SlotRef | null {
  if (!item) return null;
  const channels = item.channels ?? [];
  const preferred = [
    ...channels.filter((channel) => channel.kind === "maintained"),
    ...channels.filter((channel) => channel.kind === "momentary"),
  ];
  for (const channel of preferred) {
    for (const event of eventsForKind(channel.kind)) {
      if (!findRecipe(recipes, { channelId: channel.id, event })) {
        return { channelId: channel.id, event };
      }
    }
  }
  const channel = preferred[0] ?? channels[0];
  if (!channel) return null;
  return { channelId: channel.id, event: eventsForKind(channel.kind)[0] };
}

function assignHint(slot: SlotRef | null, channel: Channel | undefined): string {
  if (!slot || !channel) {
    return "Select a slot on the left, then click a room, light, or scene.";
  }
  if (slot.event === "double_click") {
    return `Assigning ${channel.label} · Double-click — a scene is typical. A room or light also works.`;
  }
  if (slot.event === "short") {
    return `Assigning ${channel.label} · Short press — click a room or a light. Default action is toggle.`;
  }
  return `Assigning ${channel.label} · ${eventLabel(slot.event)} — click a room or a light.`;
}

export function BridgeWorkspace({
  bridgeid,
  bridgeIp,
  updatedAt,
  snapshot,
  switches,
}: {
  bridgeid: string;
  bridgeIp: string | null;
  updatedAt: string;
  snapshot: TopologySnapshot;
  switches: WorkspaceSwitch[];
}) {
  const router = useRouter();
  const grouped = useMemo(() => groupTopology(snapshot), [snapshot]);
  const [selectedMac, setSelectedMac] = useState<string | null>(
    switches[0]?.mac ?? null,
  );
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(() =>
    firstOpenSlot(switches[0], switches[0]?.recipes ?? []),
  );
  const [drafts, setDrafts] = useState<Record<string, Recipe[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.recipes])),
  );
  const [saved, setSaved] = useState<Record<string, Recipe[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.recipes])),
  );
  const [revs, setRevs] = useState<Record<string, number>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.rev])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.label])),
  );
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const selected = switches.find((item) => item.mac === selectedMac) ?? null;
  const recipes = selected ? (drafts[selected.mac] ?? []) : [];
  const baseline = selected ? (saved[selected.mac] ?? []) : [];
  const dirty = selected ? !recipesEqual(recipes, baseline) : false;
  const selectedChannel = selected?.channels.find(
    (channel) => channel.id === selectedSlot?.channelId,
  );
  const staleCount = recipes.filter((recipe) =>
    isTargetStale(snapshot, recipe.target),
  ).length;

  function setRecipesFor(mac: string, next: Recipe[]) {
    setDrafts((current) => ({ ...current, [mac]: next }));
  }

  function toggleSlot(slot: SlotRef) {
    setNotice(null);
    setError(null);
    setSelectedSlot((current) =>
      current &&
      current.channelId === slot.channelId &&
      current.event === slot.event
        ? null
        : slot,
    );
  }

  function maintainedChannel(): Channel | null {
    if (!selected) return null;
    if (selectedChannel?.kind === "maintained") return selectedChannel;
    return selected.channels.find((channel) => channel.kind === "maintained") ?? null;
  }

  function assignTarget(target: RecipeTarget) {
    setError(null);
    if (!selected) {
      setNotice("Select a switch on the left first.");
      return;
    }
    if (!selectedSlot) {
      setNotice("Select a channel slot, then click a destination.");
      return;
    }
    const action = defaultActionForTarget(selectedSlot.event, target.rtype);
    if (!action) {
      setNotice(incompatibleHint(selectedSlot.event));
      return;
    }
    const nextRecipes = upsertRecipe(recipes, {
      channelId: selectedSlot.channelId,
      event: selectedSlot.event,
      action,
      target,
    });
    setRecipesFor(selected.mac, nextRecipes);
    const channel = selected.channels.find(
      (item) => item.id === selectedSlot.channelId,
    );
    if (channel) {
      const events = eventsForKind(channel.kind);
      const idx = events.indexOf(selectedSlot.event);
      const following = events.slice(idx + 1).find((event) => {
        return !findRecipe(nextRecipes, { channelId: channel.id, event });
      });
      if (following) {
        setSelectedSlot({ channelId: channel.id, event: following });
      }
    }
    setNotice(null);
  }

  function assignRoomOnOff(groupedLightId: string, roomName: string) {
    setError(null);
    if (!selected) {
      setNotice("Select a switch on the left first.");
      return;
    }
    const channel = maintainedChannel();
    if (!channel) {
      setNotice(
        "Select a maintained channel (D0, D1, or D2). BOOT is a momentary button and has no on/off.",
      );
      return;
    }
    const target: RecipeTarget = {
      rtype: "grouped_light",
      rid: groupedLightId,
    };
    let next = recipes;
    next = upsertRecipe(next, {
      channelId: channel.id,
      event: "on",
      action: "on",
      target,
    });
    next = upsertRecipe(next, {
      channelId: channel.id,
      event: "off",
      action: "off",
      target,
    });
    setRecipesFor(selected.mac, next);
    setSelectedSlot({ channelId: channel.id, event: "double_click" });
    setNotice(
      `${channel.label} on and off now control ${roomName}. Optionally pick a scene for double-click.`,
    );
  }

  function clearSlot(slot: SlotRef) {
    if (!selected) return;
    setRecipesFor(selected.mac, clearRecipe(recipes, slot));
  }

  function changeAction(slot: SlotRef, action: HueAction) {
    if (!selected) return;
    const existing = findRecipe(recipes, slot);
    if (!existing) return;
    setRecipesFor(selected.mac, upsertRecipe(recipes, { ...existing, action }));
  }

  function discard() {
    if (!selected) return;
    setRecipesFor(selected.mac, saved[selected.mac] ?? []);
    setError(null);
    setNotice("Reverted to the last saved recipes.");
  }

  function clearStale() {
    if (!selected) return;
    setRecipesFor(
      selected.mac,
      recipes.filter((recipe) => !isTargetStale(snapshot, recipe.target)),
    );
    setNotice("Cleared assignments that are missing from this snapshot.");
  }

  async function save() {
    if (!selected) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/switches/${selected.mac}/recipes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipes }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        rev?: number;
        recipes?: Recipe[];
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        setError(body.details ?? body.error ?? "Could not save recipes");
        return;
      }
      const next = body.recipes ?? recipes;
      setRecipesFor(selected.mac, next);
      setSaved((current) => ({ ...current, [selected.mac]: next }));
      if (typeof body.rev === "number") {
        setRevs((current) => ({ ...current, [selected.mac]: body.rev as number }));
      }
      setSavedAt(selected.mac);
      setNotice(
        `Saved · rev ${body.rev}. The switch picks this up on poll, or immediately after reboot.`,
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const lightCount = snapshot.lights.length;
  const roomCount = snapshot.rooms.length;
  const sceneCount = snapshot.scenes.length;
  const topologyEmpty = lightCount === 0 && roomCount === 0 && sceneCount === 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bridge</h1>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted">
          <span className="font-mono text-foreground">{bridgeid}</span>
          {bridgeIp ? <span className="font-mono">{bridgeIp}</span> : null}
          <span>
            {lightCount} lights · {roomCount} rooms · {sceneCount} scenes
          </span>
          <span>Snapshot {formatWhen(updatedAt)}</span>
        </p>
      </section>

      {error ? (
        <p
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-muted">
              Switches and channels
            </h2>
            <span className="text-xs text-muted">
              {switches.length === 0
                ? "None"
                : `${switches.length} board${switches.length === 1 ? "" : "s"}`}
            </span>
          </header>

          {switches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
              <p className="font-medium text-foreground">No switches on this Bridge</p>
              <p className="mt-2">
                After Wi-Fi and Hue pairing, the XIAO POSTs{" "}
                <code className="font-mono text-xs">/api/device/register</code>{" "}
                with its MAC, channels, and a topology snapshot. Topology on
                the right can still arrive from{" "}
                <code className="font-mono text-xs">push-from-bridge</code>.
              </p>
            </div>
          ) : (
            switches.map((item) => {
              const active = item.mac === selectedMac;
              const itemRecipes = drafts[item.mac] ?? [];
              const itemDirty = !recipesEqual(itemRecipes, saved[item.mac] ?? []);
              return (
                <article
                  key={item.mac}
                  className={`rounded-xl border bg-cream ${
                    active
                      ? "border-filament/50 shadow-[0_0_0_1px_var(--filament)]"
                      : "border-line"
                  }`}
                >
                  <div className="flex items-start gap-1 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.mac === selectedMac) return;
                        setSelectedMac(item.mac);
                        setSelectedSlot(
                          firstOpenSlot(item, drafts[item.mac] ?? item.recipes),
                        );
                        setNotice(null);
                        setError(null);
                      }}
                      className="flex min-w-0 flex-1 flex-col gap-1 px-1 text-left"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {(names[item.mac] || "").trim() || formatMac(item.mac)}
                        </span>
                        {itemDirty ? (
                          <span className="shrink-0 rounded-full bg-filament-soft px-2 py-0.5 text-[11px] font-medium text-filament">
                            Unsaved
                          </span>
                        ) : savedAt === item.mac ? (
                          <span className="shrink-0 rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                            Saved
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted">
                        {formatMac(item.mac)}
                        {item.firmware ? ` · fw ${item.firmware}` : ""}
                        {` · rev ${revs[item.mac] ?? item.rev}`}
                        {item.last_seen_at
                          ? ` · seen ${formatWhen(item.last_seen_at)}`
                          : " · never seen"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted hover:bg-filament-soft hover:text-filament"
                      aria-label={`Rename ${formatMac(item.mac)}`}
                      onClick={() => setEditingMac(item.mac)}
                    >
                      <PencilIcon />
                    </button>
                  </div>
                  {editingMac === item.mac ? (
                    <SwitchRenameForm
                      mac={item.mac}
                      initial={(names[item.mac] || "").trim()}
                      onCancel={() => setEditingMac(null)}
                      onSaved={(label) => {
                        setNames((current) => ({ ...current, [item.mac]: label }));
                        setEditingMac(null);
                      }}
                      onError={setError}
                    />
                  ) : null}

                  {active ? (
                    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                      {(item.channels ?? []).length === 0 ? (
                        <p className="text-sm text-muted">
                          This board registered without channels. Re-register
                          from the firmware so BOOT / D0 / D1 / D2 appear.
                        </p>
                      ) : (
                        item.channels.map((channel) => (
                          <ChannelCard
                            key={channel.id}
                            channel={channel}
                            recipes={itemRecipes}
                            snapshot={snapshot}
                            selectedSlot={selectedSlot}
                            onSelectSlot={toggleSlot}
                            onClearSlot={clearSlot}
                            onChangeAction={changeAction}
                          />
                        ))
                      )}

                      {item.channels.length > 0 ? (
                        <div className="flex flex-col gap-2 rounded-lg bg-background/70 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                            Confirmation
                          </p>
                          {itemRecipes.length === 0 ? (
                            <p className="text-sm text-muted">
                              Nothing assigned yet. Empty slots are no-ops on
                              the switch. Incomplete (on and off without
                              double-click) is valid.
                            </p>
                          ) : null}
                          <div className="flex flex-col gap-1 text-sm leading-relaxed">
                            {item.channels.map((channel) => (
                              <p key={channel.id}>
                                {confirmationForChannel(
                                  channel,
                                  itemRecipes,
                                  snapshot,
                                )}
                              </p>
                            ))}
                          </div>
                          {staleCount > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs text-warn">
                                {staleCount} assignment
                                {staleCount === 1 ? " is" : "s are"} missing
                                from this snapshot. Saving will be rejected
                                until {staleCount === 1 ? "it is" : "they are"}{" "}
                                cleared.
                              </p>
                              <button
                                type="button"
                                onClick={clearStale}
                                className="text-xs font-medium text-warn hover:underline"
                              >
                                Clear stale
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-cream/95 px-3 py-2 backdrop-blur">
                        <button
                          type="button"
                          onClick={save}
                          disabled={!dirty || pending}
                          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-50"
                        >
                          {pending ? "Saving…" : "Save recipes"}
                        </button>
                        <button
                          type="button"
                          onClick={discard}
                          disabled={!dirty || pending}
                          className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          Discard
                        </button>
                        {!dirty && savedAt === item.mac ? (
                          <span className="text-xs text-ok">Saved</span>
                        ) : null}
                        {dirty ? (
                          <span className="text-xs text-filament">
                            Unsaved changes
                          </span>
                        ) : null}
                        {!dirty && savedAt !== item.mac ? (
                          <span className="text-xs text-muted">
                            Empty slots stay empty.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-3">
          <header className="flex flex-col gap-1">
            <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-muted">
              Topology
            </h2>
            <p className="text-sm text-muted">
              {assignHint(selectedSlot, selectedChannel)}
            </p>
            {notice ? (
              <p className="text-sm text-filament" role="status">
                {notice}
              </p>
            ) : null}
          </header>

          {topologyEmpty ? (
            <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
              <p className="font-medium text-foreground">No topology yet</p>
              <p className="mt-2">
                The console never calls the Hue Bridge. A switch (or{" "}
                <code className="font-mono text-xs">npm run push-from-bridge</code>{" "}
                on the LAN) must upload rooms, lights, and scenes.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.rooms.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
                  Snapshot has no rooms. Lights and scenes are listed below.
                </p>
              ) : null}

              {grouped.rooms.map(({ room, lights, scenes }) => (
                <article
                  key={room.id}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-medium">{room.name}</h3>
                    <span className="text-xs uppercase tracking-[0.12em] text-muted">
                      {room.rtype === "zone" ? "Zone" : "Room"}
                    </span>
                  </header>

                  {room.grouped_light_id ? (
                    <div className="flex flex-wrap gap-2">
                      <TargetButton
                        label="Whole room"
                        detail="grouped light"
                        active={Boolean(
                          selectedSlot &&
                            findRecipe(recipes, selectedSlot)?.target.rid ===
                              room.grouped_light_id,
                        )}
                        onClick={() =>
                          assignTarget({
                            rtype: "grouped_light",
                            rid: room.grouped_light_id as string,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          assignRoomOnOff(room.grouped_light_id as string, room.name)
                        }
                        className="rounded-md border border-filament/40 bg-filament-soft px-3 py-1.5 text-sm font-medium"
                      >
                        Use this room for on and off
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      This room has no grouped light. Assign individual lamps.
                    </p>
                  )}

                  {lights.length > 0 ? (
                    <TargetGroup title="Lights">
                      {lights.map((light) => (
                        <TargetButton
                          key={light.id}
                          label={light.name}
                          detail={light.on === true ? "on" : light.on === false ? "off" : undefined}
                          active={Boolean(
                            selectedSlot &&
                              findRecipe(recipes, selectedSlot)?.target.rid ===
                                light.id,
                          )}
                          onClick={() =>
                            assignTarget({ rtype: "light", rid: light.id })
                          }
                        />
                      ))}
                    </TargetGroup>
                  ) : (
                    <p className="text-xs text-muted">No lights listed in this room.</p>
                  )}

                  {scenes.length > 0 ? (
                    <TargetGroup title="Scenes">
                      {scenes.map((scene) => (
                        <TargetButton
                          key={scene.id}
                          label={scene.name}
                          detail="scene"
                          active={Boolean(
                            selectedSlot &&
                              findRecipe(recipes, selectedSlot)?.target.rid ===
                                scene.id,
                          )}
                          onClick={() =>
                            assignTarget({ rtype: "scene", rid: scene.id })
                          }
                        />
                      ))}
                    </TargetGroup>
                  ) : (
                    <p className="text-xs text-muted">
                      No scenes for this room. Double-click can stay empty.
                    </p>
                  )}
                </article>
              ))}

              {grouped.ungroupedLights.length > 0 ? (
                <article className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
                  <h3 className="text-base font-medium">Ungrouped lights</h3>
                  <TargetGroup title="Lights">
                    {grouped.ungroupedLights.map((light) => (
                      <TargetButton
                        key={light.id}
                        label={light.name}
                        active={Boolean(
                          selectedSlot &&
                            findRecipe(recipes, selectedSlot)?.target.rid ===
                              light.id,
                        )}
                        onClick={() =>
                          assignTarget({ rtype: "light", rid: light.id })
                        }
                      />
                    ))}
                  </TargetGroup>
                </article>
              ) : null}

              {grouped.ungroupedScenes.length > 0 ? (
                <article className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
                  <h3 className="text-base font-medium">Other scenes</h3>
                  <TargetGroup title="Scenes">
                    {grouped.ungroupedScenes.map((scene) => (
                      <TargetButton
                        key={scene.id}
                        label={scene.name}
                        detail="scene"
                        active={Boolean(
                          selectedSlot &&
                            findRecipe(recipes, selectedSlot)?.target.rid ===
                              scene.id,
                        )}
                        onClick={() =>
                          assignTarget({ rtype: "scene", rid: scene.id })
                        }
                      />
                    ))}
                  </TargetGroup>
                </article>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChannelCard({
  channel,
  recipes,
  snapshot,
  selectedSlot,
  onSelectSlot,
  onClearSlot,
  onChangeAction,
}: {
  channel: Channel;
  recipes: Recipe[];
  snapshot: TopologySnapshot;
  selectedSlot: SlotRef | null;
  onSelectSlot: (slot: SlotRef) => void;
  onClearSlot: (slot: SlotRef) => void;
  onChangeAction: (slot: SlotRef, action: HueAction) => void;
}) {
  const events = eventsForKind(channel.kind);
  return (
    <div
      className={`flex flex-col gap-2 border-l-2 pl-3 ${
        channel.kind === "maintained"
          ? "border-filament/70"
          : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {channel.label}
          <span className="ml-2 text-xs font-normal text-muted">
            {kindLabel(channel.kind)} · GPIO {channel.gpio}
          </span>
        </p>
        {channel.kind === "momentary" ? (
          <p className="text-xs text-muted">
            Long press re-pairs Hue. It is not a recipe.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        {events.map((event) => {
          const slot = { channelId: channel.id, event };
          const recipe = findRecipe(recipes, slot);
          const selected =
            selectedSlot?.channelId === channel.id &&
            selectedSlot.event === event;
          const stale = recipe ? isTargetStale(snapshot, recipe.target) : false;
          const targetName = recipe
            ? nameForTarget(snapshot, recipe.target)
            : null;
          return (
            <div
              key={event}
              className={`flex items-stretch gap-2 rounded-lg border px-2.5 py-2 ${
                selected
                  ? "border-filament bg-filament-soft"
                  : stale
                    ? "border-warn/40 bg-warn-soft"
                    : recipe
                      ? "border-line bg-background/40"
                      : "border-dashed border-line"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSlot(slot)}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
              >
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
                  {eventLabel(event)}
                </span>
                {recipe ? (
                  <span className="text-sm">
                    {actionClause(
                      recipe.action,
                      targetName ?? "unknown target",
                    )}
                    {stale ? " — missing from snapshot" : ""}
                  </span>
                ) : (
                  <span className="text-sm text-muted">
                    Unassigned — this event does nothing
                  </span>
                )}
              </button>
              {recipe ? (
                <div className="flex shrink-0 items-center gap-1">
                  {actionsForTarget(recipe.target.rtype).length > 1 ? (
                    <label className="sr-only" htmlFor={`action-${channel.id}-${event}`}>
                      Hue action
                    </label>
                  ) : null}
                  {actionsForTarget(recipe.target.rtype).length > 1 ? (
                    <select
                      id={`action-${channel.id}-${event}`}
                      value={recipe.action}
                      onChange={(ev) =>
                        onChangeAction(slot, ev.target.value as HueAction)
                      }
                      className="rounded-md border border-line bg-cream px-1.5 py-1 text-xs"
                    >
                      {actionsForTarget(recipe.target.rtype).map((action) => (
                        <option key={action} value={action}>
                          {actionLabel(action)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onClearSlot(slot)}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:text-danger"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TargetGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function TargetButton({
  label,
  detail,
  active,
  onClick,
}: {
  label: string;
  detail?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-left text-sm ${
        active
          ? "border-filament bg-filament-soft"
          : "border-line hover:border-filament/50"
      }`}
    >
      <span>{label}</span>
      {detail ? (
        <span className="ml-2 text-xs text-muted">{detail}</span>
      ) : null}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-8.486 8.486a2 2 0 0 1-.707.464l-3.04 1.013a.5.5 0 0 1-.64-.64l1.013-3.04a2 2 0 0 1 .464-.707l8.486-8.486ZM15 5l-1-1" />
    </svg>
  );
}

function SwitchRenameForm({
  mac,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  mac: string;
  initial: string;
  onCancel: () => void;
  onSaved: (label: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    onError(null);
    try {
      const label = value.trim() || null;
      const res = await fetch(`/api/switches/${mac}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = (await res.json()) as { error?: string; details?: string; label?: string | null };
      if (!res.ok) {
        onError(body.details ?? body.error ?? "Could not rename switch");
        return;
      }
      onSaved(body.label ?? label);
    } catch {
      onError("Could not rename switch");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-2 border-t border-line px-4 py-3"
    >
      <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted" htmlFor={`rename-${mac}`}>
        Display name
      </label>
      <input
        id={`rename-${mac}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        maxLength={80}
        autoFocus
        placeholder={formatMac(mac)}
        className="rounded-md border border-line bg-background px-3 py-1.5 text-sm outline-none focus:border-filament"
        disabled={pending}
      />
      <p className="text-xs text-muted">Shown only in this console. The switch keeps using its MAC.</p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
