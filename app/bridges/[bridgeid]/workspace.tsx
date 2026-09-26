"use client";

import {
  RoundPagesEditor,
  type PageSlotRef,
  type RoundDraft,
} from "@/app/bridges/[bridgeid]/round-pages-editor";
import {
  SimpleChannelsEditor,
  type SimpleSlotRef,
} from "@/app/bridges/[bridgeid]/simple-channels-editor";
import { formatMac } from "@/lib/mac";
import { compareVersions } from "@/lib/web-setup/devices";
import {
  DEFAULT_SCREEN_TIMEOUT_SEC,
  MAX_SCENE_LIST,
  isScreenTimeoutSec,
  clearRoundRecipe,
  clearStaleRoundRecipes,
  defaultRoundActionForTarget,
  findRoundRecipe,
  pagesEqual,
  roundRecipesEqual,
  sceneGroupRid,
  sceneListItem,
  staleRoundCount,
  targetBelongsToGroup,
  upsertRoundRecipe,
} from "@/lib/pages";
import { groupTopology } from "@/lib/recipes";
import {
  clearStaleSimple,
  groupRoom,
  isSimpleChannelStale,
  simpleChannelsEqual,
  supportsChannelTypes,
  supportsHoldDim,
  withTarget,
} from "@/lib/simple-channels";
import type {
  RecipeTarget,
  RoundRecipe,
  SceneListItem,
  SimpleChannelConfig,
  SimpleGesture,
  SwitchPage,
  SwitchPublic,
  TopologySnapshot,
} from "@/lib/types";
import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type WorkspaceSwitch = SwitchPublic & {
  simpleChannels: SimpleChannelConfig[];
  pages: SwitchPage[];
  roundRecipes: RoundRecipe[];
};

function isRoundItem(item: WorkspaceSwitch | null | undefined): boolean {
  return item?.product === "round";
}

function roundDraftOf(item: WorkspaceSwitch): RoundDraft {
  return {
    pages: item.pages ?? [],
    recipes: item.roundRecipes ?? [],
    pageSwipeAxis: item.pageSwipeAxis ?? "horizontal",
    screenTimeoutSec: item.screenTimeoutSec ?? DEFAULT_SCREEN_TIMEOUT_SEC,
  };
}

function firstOpenPageSlot(
  pages: SwitchPage[],
  recipes: RoundRecipe[],
): PageSlotRef | null {
  if (pages.length === 0) return null;
  for (const page of pages) {
    for (const event of ["short", "double_click"] as const) {
      if (!findRoundRecipe(recipes, page.id, event)) {
        return { pageId: page.id, event };
      }
    }
  }
  return { pageId: pages[0].id, event: "short" };
}

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

function firstSimpleSlot(
  item: WorkspaceSwitch | undefined,
  configs: SimpleChannelConfig[],
): SimpleSlotRef | null {
  if (!item) return null;
  const channel =
    item.channels.find((candidate) =>
      configs.some((config) => config.id === candidate.id),
    ) ?? item.channels[0];
  return channel ? { channelId: channel.id, slot: "target" } : null;
}

function simpleAssignHint(
  slot: SimpleSlotRef | null,
  label: string | null,
  config: SimpleChannelConfig | undefined,
  groupName: string | null,
): string {
  if (!slot || !label) return "Select a channel slot, then click a light or scene.";
  if (!config) {
    return `Pick a room or zone for ${label} first. Topology then shows only that group.`;
  }
  const where = groupName ?? "its group";
  if (slot.slot === "scenes") {
    return `Assigning ${label} · Double-click — click scenes in ${where} to add or remove them. Up to 8, cycled in order.`;
  }
  if (slot.slot === "double" || slot.slot === "hold") {
    const name = slot.slot === "double" ? "Double-click" : "Hold";
    const gesture = slot.slot === "double" ? config.double : config.hold;
    if (!gesture) return `Assigning ${label} · ${name} — pick what it does first.`;
    if (gesture.action === "off") return `${label} · Hold turns off all of ${where}.`;
    return gesture.action === "recall_scene"
      ? `Assigning ${label} · ${name} — click scenes in ${where} to add or remove them.`
      : `Assigning ${label} · ${name} — click the whole ${config.group.rtype} or a light in ${where}.`;
  }
  return config.kind === "maintained"
    ? `Assigning ${label} · On / Off — click the whole ${config.group.rtype} or one light in ${where}.`
    : `Assigning ${label} · Click — click the whole ${config.group.rtype} or one light in ${where} to toggle.`;
}

function roundAssignHint(
  slot: PageSlotRef | null,
  groupName: string | null,
): string {
  if (!groupName) {
    return "Pick a room or zone for this page first. Topology only shows lights and scenes in that group.";
  }
  if (!slot) {
    return `Select Tap or Double tap, then click a light or scene in ${groupName}.`;
  }
  if (slot.event === "double_click") {
    return `Assigning Double tap in ${groupName} — the room or a light turns off. A scene starts or edits a list. Off is not a scene.`;
  }
  return `Assigning Tap in ${groupName} — click a light (toggle) or a scene (cycle list).`;
}

export function BridgeWorkspace({
  bridgeid,
  bridgeIp,
  updatedAt,
  snapshot,
  switches,
  initialMac,
  latestFirmware,
}: {
  bridgeid: string;
  bridgeIp: string | null;
  updatedAt: string;
  snapshot: TopologySnapshot;
  switches: WorkspaceSwitch[];
  initialMac?: string | null;
  latestFirmware: { round: string; simple: string };
}) {
  const router = useRouter();
  const grouped = useMemo(() => groupTopology(snapshot), [snapshot]);
  const first = switches.find((item) => item.mac === initialMac) ?? switches[0];
  const [selectedMac, setSelectedMac] = useState<string | null>(
    first?.mac ?? null,
  );
  const [selectedSlot, setSelectedSlot] = useState<SimpleSlotRef | null>(() =>
    isRoundItem(first) ? null : firstSimpleSlot(first, first?.simpleChannels ?? []),
  );
  const [pageSlot, setPageSlot] = useState<PageSlotRef | null>(() =>
    isRoundItem(first)
      ? firstOpenPageSlot(first.pages ?? [], first.roundRecipes ?? [])
      : null,
  );
  const [drafts, setDrafts] = useState<Record<string, SimpleChannelConfig[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.simpleChannels])),
  );
  const [saved, setSaved] = useState<Record<string, SimpleChannelConfig[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.simpleChannels])),
  );
  const [roundDrafts, setRoundDrafts] = useState<Record<string, RoundDraft>>(
    () =>
      Object.fromEntries(
        switches.filter(isRoundItem).map((item) => [item.mac, roundDraftOf(item)]),
      ),
  );
  const [roundSaved, setRoundSaved] = useState<Record<string, RoundDraft>>(() =>
    Object.fromEntries(
      switches.filter(isRoundItem).map((item) => [item.mac, roundDraftOf(item)]),
    ),
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
  const round = isRoundItem(selected);
  const simpleConfigs = selected ? (drafts[selected.mac] ?? []) : [];
  const baseline = selected ? (saved[selected.mac] ?? []) : [];
  const roundDraft = selected ? roundDrafts[selected.mac] : undefined;
  const roundBaseline = selected ? roundSaved[selected.mac] : undefined;
  const dirty = selected
    ? round
      ? Boolean(
          roundDraft &&
            roundBaseline &&
            (roundDraft.pageSwipeAxis !== roundBaseline.pageSwipeAxis ||
              roundDraft.screenTimeoutSec !== roundBaseline.screenTimeoutSec ||
              !pagesEqual(roundDraft.pages, roundBaseline.pages) ||
              !roundRecipesEqual(roundDraft.recipes, roundBaseline.recipes)),
        )
      : !simpleChannelsEqual(simpleConfigs, baseline)
    : false;
  const selectedChannel = selected?.channels.find(
    (channel) => channel.id === selectedSlot?.channelId,
  );
  const selectedConfig = simpleConfigs.find(
    (config) => config.id === selectedSlot?.channelId,
  );
  const simpleFirmwareOk = selected ? supportsChannelTypes(selected.firmware) : false;
  const simpleDimOk = selected ? supportsHoldDim(selected.firmware) : false;
  const staleCount = round
    ? staleRoundCount(roundDraft?.recipes ?? [], snapshot)
    : simpleConfigs.filter((config) => isSimpleChannelStale(config, snapshot)).length;

  function isTargetActive(rid: string): boolean {
    if (round && pageSlot && roundDraft) {
      const rec = findRoundRecipe(
        roundDraft.recipes,
        pageSlot.pageId,
        pageSlot.event,
      );
      if (!rec) return false;
      if (rec.action === "recall_scene") {
        return (rec.targets ?? []).some((item) => item.rid === rid);
      }
      return rec.target?.rid === rid;
    }
    if (!selectedSlot || !selectedConfig) return false;
    if (selectedSlot.slot === "scenes") {
      return selectedConfig.scenes.some((item) => item.rid === rid);
    }
    if (selectedSlot.slot === "double" || selectedSlot.slot === "hold") {
      const gesture =
        selectedSlot.slot === "double" ? selectedConfig.double : selectedConfig.hold;
      if (!gesture) return false;
      return gesture.action === "recall_scene"
        ? gesture.targets.some((item) => item.rid === rid)
        : gesture.target.rid === rid;
    }
    return selectedConfig.target.rid === rid;
  }

  function setSimpleFor(mac: string, next: SimpleChannelConfig[]) {
    setDrafts((current) => ({ ...current, [mac]: next }));
  }

  function setRoundDraft(mac: string, next: RoundDraft) {
    setRoundDrafts((current) => ({ ...current, [mac]: next }));
  }

  function selectSimpleSlot(slot: SimpleSlotRef) {
    setNotice(null);
    setError(null);
    setSelectedSlot(slot);
  }

  function assignRoundTarget(target: RecipeTarget) {
    if (!selected || !roundDraft) return;
    if (!pageSlot) {
      setNotice("Select Tap or Double tap, then click a destination.");
      return;
    }
    const page = roundDraft.pages.find((item) => item.id === pageSlot.pageId);
    if (!page?.group) {
      setNotice("Pick a room or zone for this page first.");
      return;
    }
    if (!targetBelongsToGroup(target, page.group, snapshot)) {
      setNotice("That light or scene is not in this page's room or zone.");
      return;
    }
    const current = findRoundRecipe(
      roundDraft.recipes,
      pageSlot.pageId,
      pageSlot.event,
    );
    if (target.rtype === "scene") {
      const existing =
        current?.action === "recall_scene" ? (current.targets ?? []) : [];
      if (existing.some((item) => item.rid === target.rid)) {
        const nextTargets = existing.filter((item) => item.rid !== target.rid);
        const nextRecipes =
          nextTargets.length === 0
            ? clearRoundRecipe(
                roundDraft.recipes,
                pageSlot.pageId,
                pageSlot.event,
              )
            : upsertRoundRecipe(roundDraft.recipes, {
                pageId: pageSlot.pageId,
                event: pageSlot.event,
                action: "recall_scene",
                targets: nextTargets,
              });
        setRoundDraft(selected.mac, { ...roundDraft, recipes: nextRecipes });
        setNotice(null);
        return;
      }
      if (existing.length > 0) {
        const group = sceneGroupRid(snapshot, existing[0].rid);
        const nextGroup = sceneGroupRid(snapshot, target.rid);
        if (!group || !nextGroup || group !== nextGroup) {
          setNotice("Scenes must be in the same room or zone.");
          return;
        }
      }
      if (existing.length >= MAX_SCENE_LIST) {
        setNotice("A scene list can have at most 8 scenes.");
        return;
      }
      const nextRecipes = upsertRoundRecipe(roundDraft.recipes, {
        pageId: pageSlot.pageId,
        event: pageSlot.event,
        action: "recall_scene",
        targets: [...existing, sceneListItem(snapshot, target.rid)],
      });
      setRoundDraft(selected.mac, { ...roundDraft, recipes: nextRecipes });
      setNotice(null);
      return;
    }
    const action = defaultRoundActionForTarget(pageSlot.event, target.rtype);
    const nextRecipes = upsertRoundRecipe(roundDraft.recipes, {
      pageId: pageSlot.pageId,
      event: pageSlot.event,
      action,
      target,
    });
    setRoundDraft(selected.mac, { ...roundDraft, recipes: nextRecipes });
    if (pageSlot.event === "short") {
      const dblEmpty = !findRoundRecipe(
        nextRecipes,
        pageSlot.pageId,
        "double_click",
      );
      if (dblEmpty) {
        setPageSlot({ pageId: pageSlot.pageId, event: "double_click" });
      }
    }
    setNotice(null);
  }

  function assignTarget(target: RecipeTarget) {
    setError(null);
    if (!selected) {
      setNotice("Select a switch above first.");
      return;
    }
    if (round) {
      assignRoundTarget(target);
      return;
    }
    assignSimpleTarget(target);
  }

  function toggleScene(scenes: SceneListItem[], rid: string): SceneListItem[] | null {
    if (scenes.some((item) => item.rid === rid)) {
      return scenes.filter((item) => item.rid !== rid);
    }
    if (scenes.length >= MAX_SCENE_LIST) {
      setNotice(`A scene list can have at most ${MAX_SCENE_LIST} scenes.`);
      return null;
    }
    return [...scenes, sceneListItem(snapshot, rid)];
  }

  function assignSimpleTarget(target: RecipeTarget) {
    if (!selected) return;
    if (!simpleFirmwareOk) {
      setNotice("Update this switch's firmware to configure it.");
      return;
    }
    if (!selectedSlot || !selectedConfig) {
      setNotice("Pick a room or zone for a channel, then click a light or scene.");
      return;
    }
    const config = selectedConfig;
    if (!targetBelongsToGroup(target, config.group, snapshot)) {
      setNotice("That light or scene is not in this channel's room or zone.");
      return;
    }
    const gestureSlot =
      selectedSlot.slot === "double" || selectedSlot.slot === "hold"
        ? selectedSlot.slot
        : null;
    const gesture =
      gestureSlot === "double" ? config.double : gestureSlot === "hold" ? config.hold : null;
    const withGesture = (value: SimpleGesture): SimpleChannelConfig =>
      gestureSlot === "double" ? { ...config, double: value } : { ...config, hold: value };
    let next: SimpleChannelConfig;
    if (gestureSlot && !gesture) {
      setNotice("Pick what this gesture does first.");
      return;
    }
    if (gesture?.action === "recall_scene") {
      if (target.rtype !== "scene") {
        setNotice("This gesture cycles scenes. Pick a scene from the list.");
        return;
      }
      const targets = toggleScene(gesture.targets, target.rid);
      if (!targets) return;
      next = withGesture({ action: "recall_scene", targets });
    } else if (gesture?.action === "off") {
      setNotice("Hold turns off the whole room or zone. There is nothing to pick.");
      return;
    } else if (gesture) {
      if (target.rtype === "scene") {
        setNotice("Dim needs a light or the whole room or zone, not a scene.");
        return;
      }
      next = withGesture({ action: gesture.action, target });
    } else if (target.rtype === "scene") {
      if (config.kind !== "maintained") {
        setNotice(
          "A click toggles a light or the whole room. For scenes, set Double-click or Hold to Cycle scenes.",
        );
        return;
      }
      const scenes = toggleScene(config.scenes, target.rid);
      if (!scenes) return;
      next = { ...config, scenes };
      if (selectedSlot.slot !== "scenes") {
        setSelectedSlot({ channelId: config.id, slot: "scenes" });
      }
    } else if (selectedSlot.slot === "scenes") {
      setNotice("Double-click cycles scenes. Pick a scene from the list.");
      return;
    } else {
      next = withTarget(config, target);
    }
    setSimpleFor(
      selected.mac,
      simpleConfigs.map((item) => (item.id === config.id ? next : item)),
    );
    setNotice(
      next.hold === null && config.hold?.action === "off"
        ? "Hold turn off was cleared: the click now controls the whole room or zone."
        : null,
    );
  }

  function assignRoomTapAndOff(groupedLightId: string, roomName: string) {
    if (!selected || !roundDraft) return;
    const pageId = pageSlot?.pageId ?? roundDraft.pages[0]?.id;
    if (!pageId) return;
    const page = roundDraft.pages.find((item) => item.id === pageId);
    if (!page?.group) {
      setNotice("Pick a room or zone for this page first.");
      return;
    }
    if (page.group.groupedLightRid !== groupedLightId) {
      setNotice("That room is not this page's group.");
      return;
    }
    const target: RecipeTarget = { rtype: "grouped_light", rid: groupedLightId };
    let next = roundDraft.recipes;
    next = upsertRoundRecipe(next, {
      pageId,
      event: "short",
      action: "toggle",
      target,
    });
    next = upsertRoundRecipe(next, {
      pageId,
      event: "double_click",
      action: "off",
      target,
    });
    setRoundDraft(selected.mac, { ...roundDraft, recipes: next });
    setPageSlot({ pageId, event: "short" });
    setNotice(
      `Tap toggles ${roomName}. Double-tap turns it off. The ring dims ${roomName}.`,
    );
  }

  function discard() {
    if (!selected) return;
    if (round) {
      const baselineDraft = roundSaved[selected.mac] ?? roundDraftOf(selected);
      setRoundDraft(selected.mac, baselineDraft);
      setError(null);
      setNotice("Reverted to the last saved pages.");
      return;
    }
    setSimpleFor(selected.mac, saved[selected.mac] ?? []);
    setError(null);
    setNotice("Reverted to the last saved channels.");
  }

  function clearStale() {
    if (!selected) return;
    if (round && roundDraft) {
      setRoundDraft(selected.mac, {
        ...roundDraft,
        recipes: clearStaleRoundRecipes(roundDraft.recipes, snapshot),
      });
      setNotice("Cleared assignments that are missing from this snapshot.");
      return;
    }
    setSimpleFor(selected.mac, clearStaleSimple(simpleConfigs, snapshot));
    setNotice("Cleared assignments that are missing from this snapshot.");
  }

  async function save() {
    if (!selected) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      if (round && roundDraft) {
        if (!isScreenTimeoutSec(roundDraft.screenTimeoutSec)) {
          setError(
            "Screen timeout must be 0 (always on) or 10–600 seconds.",
          );
          return;
        }
        const res = await fetch(`/api/switches/${selected.mac}/pages`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageSwipeAxis: roundDraft.pageSwipeAxis,
            screenTimeoutSec: roundDraft.screenTimeoutSec,
            pages: roundDraft.pages.map((page) => ({
              id: page.id,
              name: page.name,
              theme: page.theme,
              group: page.group,
            })),
            recipes: roundDraft.recipes,
          }),
        });
        const body = (await res.json()) as {
          ok?: boolean;
          rev?: number;
          pages?: SwitchPage[];
          recipes?: RoundRecipe[];
          pageSwipeAxis?: RoundDraft["pageSwipeAxis"];
          screenTimeoutSec?: number;
          error?: string;
          details?: string;
        };
        if (!res.ok) {
          setError(body.details ?? body.error ?? "Could not save pages");
          return;
        }
        const next: RoundDraft = {
          pages: body.pages ?? roundDraft.pages,
          recipes: body.recipes ?? roundDraft.recipes,
          pageSwipeAxis: body.pageSwipeAxis ?? roundDraft.pageSwipeAxis,
          screenTimeoutSec: body.screenTimeoutSec ?? roundDraft.screenTimeoutSec,
        };
        setRoundDraft(selected.mac, next);
        setRoundSaved((current) => ({ ...current, [selected.mac]: next }));
        if (pageSlot && !next.pages.some((page) => page.id === pageSlot.pageId)) {
          setPageSlot(firstOpenPageSlot(next.pages, next.recipes));
        }
        if (typeof body.rev === "number") {
          setRevs((current) => ({ ...current, [selected.mac]: body.rev as number }));
        }
        setSavedAt(selected.mac);
        setNotice(
          `Saved · rev ${body.rev}. The switch picks this up on poll, or immediately after reboot.`,
        );
        router.refresh();
        return;
      }
      const res = await fetch(`/api/switches/${selected.mac}/channels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: simpleConfigs.map((config) => ({
            id: config.id,
            kind: config.kind,
            group: { rtype: config.group.rtype, rid: config.group.rid },
            target: config.target,
            scenes: config.scenes.map((item) => item.rid),
            double: config.double,
            hold: config.hold,
          })),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        rev?: number;
        channels?: SimpleChannelConfig[];
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        setError(body.details ?? body.error ?? "Could not save channels");
        return;
      }
      const next = body.channels ?? simpleConfigs;
      setSimpleFor(selected.mac, next);
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
  const selectedPage =
    round && roundDraft
      ? (roundDraft.pages.find((page) => page.id === pageSlot?.pageId) ??
        roundDraft.pages[0] ??
        null)
      : null;
  const pageGroup = selectedPage?.group ?? null;
  const pageGroupName = pageGroup
    ? (snapshot.rooms.find((room) => room.id === pageGroup.rid)?.name ?? null)
    : null;
  const simpleGroup = !round ? (selectedConfig?.group ?? null) : null;
  const simpleGroupName = simpleGroup
    ? (groupRoom(snapshot, simpleGroup)?.name ?? null)
    : null;
  const focusGroup = round ? pageGroup : simpleGroup;
  const visibleRooms = focusGroup
    ? grouped.rooms.filter((item) => item.room.id === focusGroup.rid)
    : [];

  function itemDirty(item: WorkspaceSwitch): boolean {
    if (isRoundItem(item)) {
      const draft = roundDrafts[item.mac];
      const base = roundSaved[item.mac];
      return Boolean(
        draft &&
          base &&
          (draft.pageSwipeAxis !== base.pageSwipeAxis ||
            draft.screenTimeoutSec !== base.screenTimeoutSec ||
            !pagesEqual(draft.pages, base.pages) ||
            !roundRecipesEqual(draft.recipes, base.recipes)),
      );
    }
    return !simpleChannelsEqual(drafts[item.mac] ?? [], saved[item.mac] ?? []);
  }

  function selectBoard(item: WorkspaceSwitch) {
    if (item.mac === selectedMac) return;
    setSelectedMac(item.mac);
    setEditingMac(null);
    if (isRoundItem(item)) {
      const draft = roundDrafts[item.mac] ?? roundDraftOf(item);
      setSelectedSlot(null);
      setPageSlot(firstOpenPageSlot(draft.pages, draft.recipes));
    } else {
      setPageSlot(null);
      setSelectedSlot(firstSimpleSlot(item, drafts[item.mac] ?? item.simpleChannels));
    }
    setNotice(null);
    setError(null);
  }

  // Newer uploaded firmware for this board's product, or null when it is current.
  function updateFor(item: WorkspaceSwitch): string | null {
    const latest = latestFirmware[isRoundItem(item) ? "round" : "simple"];
    return compareVersions(item.firmware ?? "", latest) === -1 ? latest : null;
  }

  function boardName(item: WorkspaceSwitch): string {
    return (names[item.mac] || "").trim() || formatMac(item.mac);
  }

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

      {switches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No switches on this Bridge</p>
          <p className="mt-2">
            Set up a board on{" "}
            <Link href="/devices" className="text-filament underline underline-offset-2">
              Devices
            </Link>
            . It shows up here once it pairs with this Bridge.
          </p>
        </div>
      ) : (
        <nav aria-label="Switches" className="flex flex-wrap gap-2">
          {switches.map((item) => {
            const active = item.mac === selectedMac;
            const dirtyItem = itemDirty(item);
            return (
              <button
                key={item.mac}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => selectBoard(item)}
                className={`flex min-w-0 max-w-full flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2 text-left ${
                  active
                    ? "border-filament/60 bg-filament-soft shadow-[0_0_0_1px_var(--filament)]"
                    : "border-line bg-cream hover:border-filament/40"
                }`}
              >
                <span className="flex max-w-full items-center gap-2">
                  <span className="truncate text-sm font-medium">{boardName(item)}</span>
                  {dirtyItem ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-filament"
                      aria-label="Unsaved changes"
                      title="Unsaved changes"
                    />
                  ) : null}
                </span>
                <span className="text-xs text-muted">
                  {isRoundItem(item) ? "Round" : "Simple"}
                  {item.last_seen_at
                    ? ` · seen ${formatWhen(item.last_seen_at)}`
                    : " · never seen"}
                  {updateFor(item) ? (
                    <span className="text-filament"> · update</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
        {selected ? (
          <section
            aria-label={`${boardName(selected)} settings`}
            className="rounded-xl border border-line bg-cream"
          >
            <header className="flex items-start gap-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-medium">
                  <span className="truncate">{boardName(selected)}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                    {round ? "Round" : "Simple"}
                  </span>
                  {dirty ? (
                    <span className="rounded-full bg-filament-soft px-2 py-0.5 text-[11px] font-medium text-filament">
                      Unsaved
                    </span>
                  ) : savedAt === selected.mac ? (
                    <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                      Saved
                    </span>
                  ) : null}
                  {updateFor(selected) ? (
                    <Link
                      href="/devices"
                      title="Plug the board in over USB and install from Devices"
                      className="rounded-full border border-filament/50 px-2 py-0.5 text-[11px] font-medium text-filament hover:bg-filament-soft"
                    >
                      Update to {updateFor(selected)}
                    </Link>
                  ) : null}
                </h2>
                <p className="text-xs text-muted">
                  <span className="font-mono">{formatMac(selected.mac)}</span>
                  {selected.firmware ? ` · firmware ${selected.firmware}` : ""}
                  {` · rev ${revs[selected.mac] ?? selected.rev}`}
                  {" · "}
                  <Link
                    href={round ? "/how-to#round" : "/how-to#simple"}
                    className="text-filament underline underline-offset-2"
                  >
                    {round ? "What the screen shows" : "What the LED shows"}
                  </Link>
                </p>
              </div>
              <button
                type="button"
                className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted hover:bg-filament-soft hover:text-filament"
                aria-label={`Rename ${boardName(selected)}`}
                onClick={() => setEditingMac(selected.mac)}
              >
                <PencilIcon />
              </button>
            </header>
            {editingMac === selected.mac ? (
              <SwitchRenameForm
                key={selected.mac}
                mac={selected.mac}
                initial={(names[selected.mac] || "").trim()}
                onCancel={() => setEditingMac(null)}
                onSaved={(label) => {
                  setNames((current) => ({ ...current, [selected.mac]: label }));
                  setEditingMac(null);
                }}
                onError={setError}
              />
            ) : null}

            {round && roundDraft ? (
              <RoundPagesEditor
                snapshot={snapshot}
                draft={roundDraft}
                selectedSlot={pageSlot}
                pending={pending}
                dirty={dirty}
                savedFlash={savedAt === selected.mac}
                staleCount={staleCount}
                onSelectSlot={setPageSlot}
                onChange={(next) => setRoundDraft(selected.mac, next)}
                onSave={save}
                onDiscard={discard}
                onClearStale={clearStale}
              />
            ) : null}

            {!round ? (
              <SimpleChannelsEditor
                channels={selected.channels}
                configs={simpleConfigs}
                snapshot={snapshot}
                firmware={simpleFirmwareOk}
                dimSupported={simpleDimOk}
                selectedSlot={selectedSlot}
                pending={pending}
                dirty={dirty}
                savedFlash={savedAt === selected.mac}
                staleCount={staleCount}
                onSelectSlot={selectSimpleSlot}
                onChange={(next) => setSimpleFor(selected.mac, next)}
                onSave={save}
                onDiscard={discard}
                onClearStale={clearStale}
              />
            ) : null}
          </section>
        ) : (
          <div />
        )}

        <section
          aria-label="Lights and scenes"
          className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1"
        >
          <header className="flex flex-col gap-1">
            <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-muted">
              Lights and scenes
            </h2>
            <p className="text-sm text-muted">
              {round
                ? roundAssignHint(pageSlot, pageGroupName)
                : simpleAssignHint(
                    selectedSlot,
                    selectedChannel?.label ?? null,
                    selectedConfig,
                    simpleGroupName,
                  )}
            </p>
            {notice ? (
              <p className="text-sm text-filament" role="status">
                {notice}
              </p>
            ) : null}
          </header>

          {topologyEmpty ? (
            <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
              <p className="font-medium text-foreground">No lights yet</p>
              <p className="mt-2">
                A switch paired with this Bridge sends its rooms, lights, and
                scenes when it checks in.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {round && !pageGroup ? (
                <p className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
                  Pick a room or zone for this page. Topology then shows only
                  that group&apos;s lights and scenes.
                </p>
              ) : null}
              {round && pageGroup && visibleRooms.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
                  This page&apos;s room or zone is missing from the snapshot.
                  Pick another group, or wait for a new topology upload.
                </p>
              ) : null}
              {!round && !simpleGroup ? (
                <p className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
                  Pick a room or zone for a channel. Topology then shows only
                  that group&apos;s lights and scenes.
                </p>
              ) : null}
              {!round && simpleGroup && visibleRooms.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
                  This channel&apos;s room or zone is missing from the snapshot.
                  Pick another group, or wait for a new topology upload.
                </p>
              ) : null}

              {visibleRooms.map(({ room, lights, scenes }) => (
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
                        active={isTargetActive(room.grouped_light_id)}
                        onClick={() =>
                          assignTarget({
                            rtype: "grouped_light",
                            rid: room.grouped_light_id as string,
                          })
                        }
                      />
                      {round ? (
                        <button
                          type="button"
                          onClick={() =>
                            assignRoomTapAndOff(room.grouped_light_id as string, room.name)
                          }
                          className="rounded-md border border-filament/40 bg-filament-soft px-3 py-1.5 text-sm font-medium"
                        >
                          Use this room for tap and double-tap
                        </button>
                      ) : null}
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
                          active={isTargetActive(light.id)}
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
                          active={isTargetActive(scene.id)}
                          onClick={() =>
                            assignTarget({ rtype: "scene", rid: scene.id })
                          }
                        />
                      ))}
                    </TargetGroup>
                  ) : (
                    <p className="text-xs text-muted">
                      No scenes for this room. The scene list can stay empty.
                    </p>
                  )}
                </article>
              ))}

            </div>
          )}
        </section>
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
