"use client";

import { RoundDial } from "@/app/bridges/[bridgeid]/round-dial";
import {
  MAX_ROUND_PAGES,
  MAX_SCENE_LIST,
  MAX_SCREEN_TIMEOUT_SEC,
  MIN_SCREEN_TIMEOUT_SEC,
  PAGE_NAME_MAX,
  confirmationForPage,
  findRoundRecipe,
  groupsEqual,
  isScreenTimeoutSec,
  normalizePageName,
  pageGroupFromRoom,
  pageNameFromGroup,
  pageNameWouldTruncate,
  pickableGroups,
  recipesForGroup,
  roundEventLabel,
  roundRecipesEqual,
} from "@/lib/pages";
import { ROUND_THEMES, roundThemeById } from "@/lib/round-themes";
import { actionLabel, actionsForTarget, isTargetStale, nameForTarget } from "@/lib/recipes";
import type {
  HueAction,
  PageGroup,
  PageSwipeAxis,
  Room,
  RoundEvent,
  RoundRecipe,
  SwitchPage,
  TopologySnapshot,
} from "@/lib/types";
import { useState } from "react";

export type PageSlotRef = { pageId: string; event: RoundEvent };

export type RoundDraft = {
  pages: SwitchPage[];
  recipes: RoundRecipe[];
  pageSwipeAxis: PageSwipeAxis;
  screenTimeoutSec: number;
};

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const nextIndex = index + dir;
  if (nextIndex < 0 || nextIndex >= list.length) return list;
  const next = [...list];
  const tmp = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = tmp;
  return next;
}

let draftPageSeq = 0;

function nextDraftPageId(): string {
  draftPageSeq += 1;
  return `draft-${draftPageSeq}`;
}

export function RoundPagesEditor({
  snapshot,
  draft,
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
  snapshot: TopologySnapshot;
  draft: RoundDraft;
  selectedSlot: PageSlotRef | null;
  pending: boolean;
  dirty: boolean;
  savedFlash: boolean;
  staleCount: number;
  onSelectSlot: (slot: PageSlotRef) => void;
  onChange: (next: RoundDraft) => void;
  onSave: () => void;
  onDiscard: () => void;
  onClearStale: () => void;
}) {
  const { pages, recipes, pageSwipeAxis, screenTimeoutSec } = draft;
  const [previewOn, setPreviewOn] = useState(true);
  const [addingPage, setAddingPage] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [nameCut, setNameCut] = useState<Record<string, boolean>>({});
  const [selectedPageId, setSelectedPageId] = useState(
    selectedSlot?.pageId ?? pages[0]?.id ?? "",
  );
  const groups = pickableGroups(snapshot);
  const selectedPage =
    pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;

  function setPages(nextPages: SwitchPage[]) {
    onChange({
      ...draft,
      pages: nextPages.map((page, index) => ({ ...page, sortOrder: index })),
    });
  }

  function patchPage(pageId: string, patch: Partial<SwitchPage>) {
    setPages(
      pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
    );
  }

  function addPage() {
    if (pages.length >= MAX_ROUND_PAGES) return;
    setAddingPage(true);
  }

  function createPage(room: Room) {
    if (pages.length >= MAX_ROUND_PAGES) return;
    const group = pageGroupFromRoom(room);
    if (!group) return;
    const id = nextDraftPageId();
    const page: SwitchPage = {
      id,
      name: pageNameFromGroup(room.name),
      sortOrder: pages.length,
      theme: "ember",
      group,
      dim: null,
    };
    const next = [...pages, page];
    onChange({ ...draft, pages: next });
    setSelectedPageId(id);
    setEditingPageId(id);
    setAddingPage(false);
    onSelectSlot({ pageId: id, event: "short" });
  }

  function changePageGroup(pageId: string, group: PageGroup) {
    const page = pages.find((item) => item.id === pageId);
    if (!page || groupsEqual(page.group, group)) return;
    const nextRecipes = recipesForGroup(recipes, pageId, group, snapshot);
    const before = recipes.filter((recipe) => recipe.pageId === pageId);
    const after = nextRecipes.filter((recipe) => recipe.pageId === pageId);
    if (!roundRecipesEqual(before, after)) {
      const ok = window.confirm(
        "Changing the group will clear tap and double-tap recipes that are not in the new room or zone.",
      );
      if (!ok) return;
    }
    onChange({
      ...draft,
      pages: pages.map((item, index) =>
        item.id === pageId
          ? { ...item, group, sortOrder: index }
          : { ...item, sortOrder: index },
      ),
      recipes: nextRecipes,
    });
  }

  function deletePage(page: SwitchPage) {
    if (pages.length <= 1) return;
    const ok = window.confirm(
      `Delete page ${page.name}? Its tap and double-tap recipes will be removed.`,
    );
    if (!ok) return;
    const nextPages = pages.filter((item) => item.id !== page.id);
    const nextRecipes = recipes.filter((recipe) => recipe.pageId !== page.id);
    onChange({ ...draft, pages: nextPages, recipes: nextRecipes });
    if (editingPageId === page.id) setEditingPageId(null);
    const fallback = nextPages[0];
    if (fallback) {
      setSelectedPageId(fallback.id);
      onSelectSlot({ pageId: fallback.id, event: "short" });
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Page swipe
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...draft, pageSwipeAxis: "horizontal" })}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              pageSwipeAxis === "horizontal"
                ? "border-filament bg-filament-soft"
                : "border-line"
            }`}
          >
            Left / right
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...draft, pageSwipeAxis: "vertical" })}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              pageSwipeAxis === "vertical"
                ? "border-filament bg-filament-soft"
                : "border-line"
            }`}
          >
            Up / down
          </button>
        </div>
      </div>

      <ScreenTimeoutField
        value={screenTimeoutSec}
        onValid={(n) => onChange({ ...draft, screenTimeoutSec: n })}
      />

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Pages
        </h3>
        <button
          type="button"
          onClick={addPage}
          disabled={pages.length >= MAX_ROUND_PAGES}
          className="text-xs font-medium text-filament disabled:opacity-40"
        >
          Add page
        </button>
      </div>

      {addingPage ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-background/40 p-3">
          <p className="text-sm font-medium">Pick a room or zone for this page</p>
          {groups.length === 0 ? (
            <p className="text-sm text-muted">
              No rooms or zones in this snapshot. A page needs a Hue group.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => createPage(room)}
                  className="rounded-md border border-line px-3 py-1.5 text-left text-sm hover:border-filament"
                >
                  {room.name}
                  <span className="ml-2 text-xs uppercase tracking-[0.12em] text-muted">
                    {room.rtype === "zone" ? "Zone" : "Room"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAddingPage(false)}
            className="self-start text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        {pages.map((page, index) => {
          const active = page.id === selectedPage?.id;
          const editing = editingPageId === page.id;
          return (
            <div
              key={page.id}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${
                active ? "border-filament bg-filament-soft" : "border-line"
              }`}
            >
              {editing ? (
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="sr-only">Page name</span>
                  <input
                    value={page.name}
                    autoFocus
                    aria-describedby={`page-name-hint-${page.id}`}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setNameCut((current) => ({
                        ...current,
                        [page.id]: pageNameWouldTruncate(raw),
                      }));
                      patchPage(page.id, { name: normalizePageName(raw) });
                    }}
                    onBlur={(event) => {
                      patchPage(
                        page.id,
                        { name: normalizePageName(event.currentTarget.value) },
                      );
                      setEditingPageId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "Escape") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    className="min-w-0 flex-1 rounded-md border border-line bg-cream px-2 py-1 text-sm outline-none focus:border-filament"
                  />
                  <span
                    id={`page-name-hint-${page.id}`}
                    className="shrink-0 text-[11px] text-muted"
                  >
                    {page.name.length}/{PAGE_NAME_MAX}
                    {nameCut[page.id] ? " — extra is cut" : ""}
                  </span>
                </label>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPageId(page.id);
                      onSelectSlot({
                        pageId: page.id,
                        event: selectedSlot?.event ?? "short",
                      });
                    }}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                  >
                    {page.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${page.name || "page"}`}
                    onClick={() => {
                      setSelectedPageId(page.id);
                      setEditingPageId(page.id);
                      onSelectSlot({
                        pageId: page.id,
                        event: selectedSlot?.event ?? "short",
                      });
                    }}
                    className="shrink-0 rounded p-1 text-muted hover:bg-filament-soft hover:text-filament"
                  >
                    <PencilIcon />
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label="Move page up"
                disabled={index === 0}
                onClick={() => setPages(moveItem(pages, index, -1))}
                className="rounded px-1.5 text-xs text-muted disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move page down"
                disabled={index === pages.length - 1}
                onClick={() => setPages(moveItem(pages, index, 1))}
                className="rounded px-1.5 text-xs text-muted disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => deletePage(page)}
                disabled={pages.length <= 1}
                className="rounded px-1.5 text-xs text-muted hover:text-danger disabled:opacity-30"
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>

      {selectedPage ? (
        <PageEditor
          page={selectedPage}
          pages={pages}
          recipes={recipes}
          snapshot={snapshot}
          selectedSlot={selectedSlot}
          previewOn={previewOn}
          onPreviewOn={setPreviewOn}
          onSelectSlot={onSelectSlot}
          onPatchPage={(patch) => patchPage(selectedPage.id, patch)}
          onChangeGroup={(group) => changePageGroup(selectedPage.id, group)}
          onRecipesChange={(next) => onChange({ ...draft, recipes: next })}
        />
      ) : null}

      <div className="flex flex-col gap-2 rounded-lg bg-background/70 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Confirmation
        </p>
        {recipes.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing assigned yet. Empty tap or double-tap slots are no-ops.
          </p>
        ) : null}
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {pages.map((page) => (
            <p key={page.id}>
              {confirmationForPage(page, recipes, snapshot)}
            </p>
          ))}
        </div>
        {staleCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-warn">
              {staleCount} assignment
              {staleCount === 1 ? " is" : "s are"} missing from this snapshot.
              Saving will be rejected until {staleCount === 1 ? "it is" : "they are"}{" "}
              cleared.
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
          disabled={!dirty || pending}
          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save pages"}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Discard
        </button>
        {!dirty && savedFlash ? (
          <span className="text-xs text-ok">Saved</span>
        ) : null}
        {dirty ? (
          <span className="text-xs text-filament">Unsaved changes</span>
        ) : null}
        {!dirty && !savedFlash ? (
          <span className="text-xs text-muted">Empty slots stay empty.</span>
        ) : null}
      </div>
    </div>
  );
}

function PageEditor({
  page,
  pages,
  recipes,
  snapshot,
  selectedSlot,
  previewOn,
  onPreviewOn,
  onSelectSlot,
  onPatchPage,
  onChangeGroup,
  onRecipesChange,
}: {
  page: SwitchPage;
  pages: SwitchPage[];
  recipes: RoundRecipe[];
  snapshot: TopologySnapshot;
  selectedSlot: PageSlotRef | null;
  previewOn: boolean;
  onPreviewOn: (on: boolean) => void;
  onSelectSlot: (slot: PageSlotRef) => void;
  onPatchPage: (patch: Partial<SwitchPage>) => void;
  onChangeGroup: (group: PageGroup) => void;
  onRecipesChange: (recipes: RoundRecipe[]) => void;
}) {
  const pageIndex = Math.max(
    0,
    pages.findIndex((item) => item.id === page.id),
  );
  const [themeOpen, setThemeOpen] = useState(false);
  const currentTheme = roundThemeById(page.theme);
  const sample =
    findRoundRecipe(recipes, page.id, "short")?.targets?.[0]?.name ??
    findRoundRecipe(recipes, page.id, "double_click")?.targets?.[0]?.name ??
    null;
  const themePickerId = `theme-picker-${page.id}`;

  function setTargets(event: RoundEvent, targets: NonNullable<RoundRecipe["targets"]>) {
    const without = recipes.filter(
      (recipe) => !(recipe.pageId === page.id && recipe.event === event),
    );
    if (targets.length === 0) {
      onRecipesChange(without);
      return;
    }
    onRecipesChange([
      ...without,
      { pageId: page.id, event, action: "recall_scene", targets },
    ]);
  }

  const rooms = pickableGroups(snapshot);
  const groupRid = page.group?.rid ?? "";
  const groupMissing =
    Boolean(page.group) && !rooms.some((room) => room.id === page.group?.rid);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-background/40 p-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          Group
        </span>
        <select
          value={groupRid}
          onChange={(event) => {
            const room = rooms.find((item) => item.id === event.target.value);
            if (!room) return;
            const group = pageGroupFromRoom(room);
            if (group) onChangeGroup(group);
          }}
          className="rounded-md border border-line bg-cream px-2 py-1.5 text-sm outline-none focus:border-filament"
        >
          {!groupRid ? (
            <option value="">Select a room or zone</option>
          ) : null}
          {groupMissing && page.group ? (
            <option value={page.group.rid}>Unknown group — pick another</option>
          ) : null}
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} ({room.rtype === "zone" ? "zone" : "room"})
            </option>
          ))}
        </select>
        {!page.group ? (
          <span className="text-xs text-warn">
            Required. Lights and scenes come only from this room or zone.
          </span>
        ) : null}
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={themeOpen}
            aria-controls={themePickerId}
            onClick={() => setThemeOpen((open) => !open)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left touch-manipulation sm:min-h-0"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Theme
            </span>
            <span className="truncate text-sm font-medium">{currentTheme.name}</span>
            <span className="ml-auto text-xs text-muted" aria-hidden="true">
              {themeOpen ? "▴" : "▾"}
            </span>
          </button>
          {themeOpen ? (
            <button
              type="button"
              onClick={() => onPreviewOn(!previewOn)}
              className="shrink-0 text-xs font-medium text-filament"
            >
              Preview {previewOn ? "On" : "Off"}
            </button>
          ) : null}
        </div>
        <div id={themePickerId}>
          {themeOpen ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ROUND_THEMES.map((theme) => {
                const selected = page.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onPatchPage({ theme: theme.id })}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 ${
                      selected
                        ? "border-filament shadow-[0_0_0_1px_var(--filament)]"
                        : "border-line hover:border-filament/50"
                    }`}
                  >
                    <RoundDial
                      theme={theme}
                      name={page.name || theme.name}
                      scene={sample}
                      pageCount={pages.length}
                      activeIndex={pageIndex}
                      on={previewOn}
                      size={96}
                    />
                    <span className="text-xs font-medium">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setThemeOpen(true)}
              className="flex items-center gap-3 self-start rounded-xl border border-line p-2 touch-manipulation"
            >
              <RoundDial
                theme={currentTheme}
                name={page.name || currentTheme.name}
                scene={sample}
                pageCount={pages.length}
                activeIndex={pageIndex}
                on={previewOn}
                size={72}
              />
              <span className="text-xs text-muted">Change</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(["short", "double_click"] as const).map((event) => (
          <RoundSlot
            key={event}
            page={page}
            event={event}
            recipes={recipes}
            snapshot={snapshot}
            selected={
              selectedSlot?.pageId === page.id && selectedSlot.event === event
            }
            onSelect={() => onSelectSlot({ pageId: page.id, event })}
            onClear={() =>
              onRecipesChange(
                recipes.filter(
                  (recipe) =>
                    !(recipe.pageId === page.id && recipe.event === event),
                ),
              )
            }
            onChangeAction={(action) => {
              const existing = findRoundRecipe(recipes, page.id, event);
              if (!existing || existing.action === "recall_scene") return;
              onRecipesChange(
                recipes.map((recipe) =>
                  recipe.pageId === page.id && recipe.event === event
                    ? { ...recipe, action }
                    : recipe,
                ),
              );
            }}
            onMoveScene={(index, dir) => {
              const existing = findRoundRecipe(recipes, page.id, event);
              if (!existing?.targets) return;
              setTargets(event, moveItem(existing.targets, index, dir));
            }}
            onRemoveScene={(rid) => {
              const existing = findRoundRecipe(recipes, page.id, event);
              if (!existing?.targets) return;
              setTargets(
                event,
                existing.targets.filter((item) => item.rid !== rid),
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RoundSlot({
  page,
  event,
  recipes,
  snapshot,
  selected,
  onSelect,
  onClear,
  onChangeAction,
  onMoveScene,
  onRemoveScene,
}: {
  page: SwitchPage;
  event: RoundEvent;
  recipes: RoundRecipe[];
  snapshot: TopologySnapshot;
  selected: boolean;
  onSelect: () => void;
  onClear: () => void;
  onChangeAction: (action: HueAction) => void;
  onMoveScene: (index: number, dir: -1 | 1) => void;
  onRemoveScene: (rid: string) => void;
}) {
  const recipe = findRoundRecipe(recipes, page.id, event);
  const stale = recipe
    ? recipe.action === "recall_scene"
      ? (recipe.targets ?? []).some((item) =>
          isTargetStale(snapshot, { rtype: "scene", rid: item.rid }),
        )
      : recipe.target
        ? isTargetStale(snapshot, recipe.target)
        : false
    : false;
  const targetName =
    recipe?.target && recipe.action !== "recall_scene"
      ? nameForTarget(snapshot, recipe.target)
      : null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-2.5 py-2 ${
        selected
          ? "border-filament bg-filament-soft"
          : stale
            ? "border-warn/40 bg-warn-soft"
            : recipe
              ? "border-line bg-background/40"
              : "border-dashed border-line"
      }`}
    >
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
        >
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
            {roundEventLabel(event)}
          </span>
          {recipe?.action === "recall_scene" ? (
            <span className="text-sm">
              {(recipe.targets ?? []).length > 1
                ? `Cycle ${(recipe.targets ?? []).map((item) => item.name || "scene").join(", ")}`
                : `Scene ${recipe.targets?.[0]?.name || "unknown target"}`}
              {stale ? " — missing from snapshot" : ""}
            </span>
          ) : recipe ? (
            <span className="text-sm">
              {actionLabel(recipe.action)} {targetName ?? "unknown target"}
              {stale ? " — missing from snapshot" : ""}
            </span>
          ) : (
            <span className="text-sm text-muted">
              Unassigned — this gesture does nothing
            </span>
          )}
        </button>
        {recipe ? (
          <div className="flex shrink-0 items-center gap-1">
            {recipe.target &&
            recipe.action !== "recall_scene" &&
            actionsForTarget(recipe.target.rtype).length > 1 ? (
              <select
                value={recipe.action}
                onChange={(event) =>
                  onChangeAction(event.target.value as HueAction)
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
              onClick={onClear}
              className="rounded-md px-2 py-1 text-xs text-muted hover:text-danger"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
      {recipe?.action === "recall_scene" && recipe.targets ? (
        <ol className="flex flex-col gap-1">
          {recipe.targets.map((item, index) => {
            const missing = isTargetStale(snapshot, {
              rtype: "scene",
              rid: item.rid,
            });
            return (
              <li
                key={item.rid}
                className="flex items-center gap-1 rounded-md bg-cream/80 px-2 py-1 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {index + 1}. {item.name || item.rid}
                  {missing ? " (missing)" : ""}
                </span>
                <button
                  type="button"
                  aria-label="Move scene up"
                  disabled={index === 0}
                  onClick={() => onMoveScene(index, -1)}
                  className="text-xs text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move scene down"
                  disabled={index === recipe.targets!.length - 1}
                  onClick={() => onMoveScene(index, 1)}
                  className="text-xs text-muted disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveScene(item.rid)}
                  className="text-xs text-muted hover:text-danger"
                >
                  Remove
                </button>
              </li>
            );
          })}
          {recipe.targets.length >= MAX_SCENE_LIST ? (
            <li className="text-xs text-muted">Maximum 8 scenes in a list.</li>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}

function ScreenTimeoutField({
  value,
  onValid,
}: {
  value: number;
  onValid: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  const parsed = Number.parseInt(text, 10);
  const error =
    draft !== null && !isScreenTimeoutSec(parsed)
      ? `Must be 0 (always on) or ${MIN_SCREEN_TIMEOUT_SEC}–${MAX_SCREEN_TIMEOUT_SEC} seconds.`
      : null;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        Screen timeout
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_SCREEN_TIMEOUT_SEC}
        step={1}
        value={text}
        aria-invalid={Boolean(error)}
        aria-describedby="screen-timeout-hint"
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const n = Number.parseInt(raw, 10);
          if (isScreenTimeoutSec(n)) onValid(n);
        }}
        onBlur={() => setDraft(null)}
        className={`w-24 rounded-md border bg-cream px-2 py-1.5 text-sm outline-none focus:border-filament ${
          error ? "border-danger" : "border-line"
        }`}
      />
      <span
        id="screen-timeout-hint"
        className={`text-xs ${error ? "text-danger" : "text-muted"}`}
      >
        {error ??
          "Seconds until the display sleeps. 0 = always on. Not 1–9."}
      </span>
    </label>
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
