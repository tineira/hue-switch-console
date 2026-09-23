"use client";

import {
  RoundPagesEditor,
  type PageSlotRef,
  type RoundDraft,
} from "@/app/bridges/[bridgeid]/round-pages-editor";
import { formatMac } from "@/lib/mac";
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
import type {
  Channel,
  ChannelEvent,
  HueAction,
  Recipe,
  RecipeTarget,
  RoundRecipe,
  SwitchPage,
  SwitchPublic,
  TopologySnapshot,
} from "@/lib/types";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type WorkspaceSwitch = SwitchPublic & {
  recipes: Recipe[];
  pages: SwitchPage[];
  roundRecipes: RoundRecipe[];
};

type SlotRef = { channelId: string; event: ChannelEvent };

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
  return `${eventLabel(event)} cannot use that target. Pick a room, light, or scene.`;
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
    return "Select a slot, then click a room, light, or scene.";
  }
  if (slot.event === "double_click") {
    return `Assigning ${channel.label} · Double-click — a scene is typical. A room or light also works.`;
  }
  if (slot.event === "short") {
    return `Assigning ${channel.label} · Short press — click a room or light (toggle) or a scene.`;
  }
  return `Assigning ${channel.label} · ${eventLabel(slot.event)} — click a room, light, or scene.`;
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
    isRoundItem(switches[0])
      ? null
      : firstOpenSlot(switches[0], switches[0]?.recipes ?? []),
  );
  const [pageSlot, setPageSlot] = useState<PageSlotRef | null>(() =>
    isRoundItem(switches[0])
      ? firstOpenPageSlot(switches[0].pages ?? [], switches[0].roundRecipes ?? [])
      : null,
  );
  const [drafts, setDrafts] = useState<Record<string, Recipe[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.recipes])),
  );
  const [saved, setSaved] = useState<Record<string, Recipe[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.recipes])),
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
  const recipes = selected ? (drafts[selected.mac] ?? []) : [];
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
      : !recipesEqual(recipes, baseline)
    : false;
  const selectedChannel = selected?.channels.find(
    (channel) => channel.id === selectedSlot?.channelId,
  );
  const staleCount = round
    ? staleRoundCount(roundDraft?.recipes ?? [], snapshot)
    : recipes.filter((recipe) => isTargetStale(snapshot, recipe.target)).length;

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
    return Boolean(
      selectedSlot && findRecipe(recipes, selectedSlot)?.target.rid === rid,
    );
  }

  function setRecipesFor(mac: string, next: Recipe[]) {
    setDrafts((current) => ({ ...current, [mac]: next }));
  }

  function setRoundDraft(mac: string, next: RoundDraft) {
    setRoundDrafts((current) => ({ ...current, [mac]: next }));
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

  function assignRoomOnOff(groupedLightId: string, roomName: string) {
    setError(null);
    if (!selected) {
      setNotice("Select a switch above first.");
      return;
    }
    if (round) {
      assignRoomTapAndOff(groupedLightId, roomName);
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
    if (round) {
      const baselineDraft = roundSaved[selected.mac] ?? roundDraftOf(selected);
      setRoundDraft(selected.mac, baselineDraft);
      setError(null);
      setNotice("Reverted to the last saved pages.");
      return;
    }
    setRecipesFor(selected.mac, saved[selected.mac] ?? []);
    setError(null);
    setNotice("Reverted to the last saved recipes.");
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
  const visibleRooms = round
    ? pageGroup
      ? grouped.rooms.filter((item) => item.room.id === pageGroup.rid)
      : []
    : grouped.rooms;

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
    return !recipesEqual(drafts[item.mac] ?? [], saved[item.mac] ?? []);
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
      setSelectedSlot(firstOpenSlot(item, drafts[item.mac] ?? item.recipes));
    }
    setNotice(null);
    setError(null);
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
              <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                {(selected.channels ?? []).length === 0 ? (
                  <p className="text-sm text-muted">
                    This board registered without channels. Re-register
                    from the firmware so BOOT / D0 / D1 / D2 appear.
                  </p>
                ) : (
                  selected.channels.map((channel) => (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      recipes={recipes}
                      snapshot={snapshot}
                      selectedSlot={selectedSlot}
                      onSelectSlot={toggleSlot}
                      onClearSlot={clearSlot}
                      onChangeAction={changeAction}
                    />
                  ))
                )}

                {selected.channels.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-lg bg-background/70 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                      Confirmation
                    </p>
                    {recipes.length === 0 ? (
                      <p className="text-sm text-muted">
                        Nothing assigned yet. Empty slots are no-ops on
                        the switch. Incomplete (on and off without
                        double-click) is valid.
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-1 text-sm leading-relaxed">
                      {selected.channels.map((channel) => (
                        <p key={channel.id}>
                          {confirmationForChannel(channel, recipes, snapshot)}
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
                  {!dirty && savedAt === selected.mac ? (
                    <span className="text-xs text-ok">Saved</span>
                  ) : null}
                  {dirty ? (
                    <span className="text-xs text-filament">Unsaved changes</span>
                  ) : null}
                  {!dirty && savedAt !== selected.mac ? (
                    <span className="text-xs text-muted">Empty slots stay empty.</span>
                  ) : null}
                </div>
              </div>
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
                : assignHint(selectedSlot, selectedChannel)}
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
              {!round && grouped.rooms.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
                  Snapshot has no rooms. Lights and scenes are listed below.
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
                      <button
                        type="button"
                        onClick={() =>
                          assignRoomOnOff(room.grouped_light_id as string, room.name)
                        }
                        className="rounded-md border border-filament/40 bg-filament-soft px-3 py-1.5 text-sm font-medium"
                      >
                        {round
                          ? "Use this room for tap and double-tap"
                          : "Use this room for on and off"}
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
                      No scenes for this room. Double-click can stay empty.
                    </p>
                  )}
                </article>
              ))}

              {!round && grouped.ungroupedLights.length > 0 ? (
                <article className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
                  <h3 className="text-base font-medium">Ungrouped lights</h3>
                  <TargetGroup title="Lights">
                    {grouped.ungroupedLights.map((light) => (
                      <TargetButton
                        key={light.id}
                        label={light.name}
                        active={isTargetActive(light.id)}
                        onClick={() =>
                          assignTarget({ rtype: "light", rid: light.id })
                        }
                      />
                    ))}
                  </TargetGroup>
                </article>
              ) : null}

              {!round && grouped.ungroupedScenes.length > 0 ? (
                <article className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
                  <h3 className="text-base font-medium">Other scenes</h3>
                  <TargetGroup title="Scenes">
                    {grouped.ungroupedScenes.map((scene) => (
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
                    <ActionSelect
                      id={`action-${channel.id}-${event}`}
                      value={recipe.action}
                      actions={actionsForTarget(recipe.target.rtype)}
                      onChange={(action) => onChangeAction(slot, action)}
                    />
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

function ActionSelect({
  id,
  value,
  actions,
  onChange,
}: {
  id: string;
  value: HueAction;
  actions: HueAction[];
  onChange: (action: HueAction) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-action-select="${id}"]`)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, id]);

  return (
    <div className="relative" data-action-select={id}>
      <label className="sr-only" htmlFor={id}>
        Hue action
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="rounded-md border border-line bg-cream px-1.5 py-1 text-xs text-foreground"
      >
        {actionLabel(value)}
      </button>
      {open ? (
        <ul
          className="absolute right-0 z-10 mt-1 min-w-24 overflow-hidden rounded-md border border-line bg-cream py-1 shadow-lg"
          role="listbox"
        >
          {actions.map((action) => (
            <li key={action}>
              <button
                type="button"
                role="option"
                aria-selected={action === value}
                className={`w-full px-2.5 py-1.5 text-left text-xs text-foreground ${
                  action === value ? "bg-filament-soft" : "hover:bg-background"
                }`}
                onClick={() => {
                  onChange(action);
                  setOpen(false);
                }}
              >
                {actionLabel(action)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
