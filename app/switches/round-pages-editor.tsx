"use client";

import Link from "next/link";
import {
  GesturePicker,
  choiceClass,
  type GestureOption,
} from "@/app/switches/gesture-picker";
import { RoomGrid } from "@/app/switches/room-grid";
import { RoundDial } from "@/app/switches/round-dial";
import {
  summarizeGesture,
  targetInGroup,
  type GestureAction,
} from "@/lib/gestures";
import {
  MAX_ROUND_PAGES,
  MAX_SCREEN_TIMEOUT_SEC,
  MIN_SCREEN_TIMEOUT_SEC,
  PAGE_NAME_MAX,
  computeDim,
  findRoundRecipe,
  foldAscii,
  isScreenTimeoutSec,
  normalizePageName,
  pageGroupFromRoom,
  pageNameFromGroup,
  pickableGroups,
} from "@/lib/pages";
import { ROUND_THEMES, roundThemeById } from "@/lib/round-themes";
import type {
  PageGroup,
  PageSwipeAxis,
  RecipeTarget,
  Room,
  RoundEvent,
  RoundRecipe,
  SceneListItem,
  SwitchPage,
  TopologySnapshot,
} from "@/lib/types";
import { useState } from "react";

export type RoundDraft = {
  pages: SwitchPage[];
  recipes: RoundRecipe[];
  pageSwipeAxis: PageSwipeAxis;
  screenTimeoutSec: number;
};

const BIG_DIAL = 208;
const STRIP_DIAL = 56;
const THEME_DIAL = 60;

const ROUND_OPTIONS: GestureOption[] = [
  { value: "none", label: "Nothing" },
  { value: "toggle", label: "Toggle" },
  { value: "on", label: "Turn on" },
  { value: "off", label: "Turn off" },
  { value: "scenes", label: "Cycle scenes" },
];

const GESTURES: { event: RoundEvent; label: string }[] = [
  { event: "short", label: "Tap" },
  { event: "double_click", label: "Double tap" },
];

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

let draftPageSeq = 0;

// "A", "A and B", "A, B and C", then "A, B and 2 more".
function lightList(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

function nextDraftPageId(): string {
  draftPageSeq += 1;
  return `draft-${draftPageSeq}`;
}

/** New page, or a page moved to another room: tap toggles the group, double tap turns it off. */
function defaultRecipes(pageId: string, group: PageGroup): RoundRecipe[] {
  const target: RecipeTarget = { rtype: "grouped_light", rid: group.groupedLightRid };
  return [
    { pageId, event: "short", action: "toggle", target },
    { pageId, event: "double_click", action: "off", target },
  ];
}

function recipeAction(recipe: RoundRecipe | undefined): GestureAction {
  if (!recipe) return "none";
  return recipe.action === "recall_scene" ? "scenes" : recipe.action;
}

export function RoundPagesEditor({
  snapshot,
  draft,
  openGesture,
  onOpenGesture,
  onChange,
  onNotice,
}: {
  snapshot: TopologySnapshot;
  draft: RoundDraft;
  openGesture: string | null;
  onOpenGesture: (key: string | null) => void;
  onChange: (next: RoundDraft) => void;
  onNotice: (text: string | null) => void;
}) {
  const { pages, recipes } = draft;
  // By id, with the position as a fallback: saving renames new pages (draft-1 → p3).
  const [selectedPage, setSelectedPage] = useState({ id: pages[0]?.id ?? "", index: 0 });
  const [addingPage, setAddingPage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [previewOn, setPreviewOn] = useState(true);
  const [deviceOpen, setDeviceOpen] = useState(false);

  const byId = pages.findIndex((page) => page.id === selectedPage.id);
  const pageIndex =
    byId >= 0 ? byId : Math.max(0, Math.min(selectedPage.index, pages.length - 1));
  const page = pages[pageIndex] ?? null;
  const pageRecipes = page ? recipes.filter((recipe) => recipe.pageId === page.id) : [];
  const sample =
    pageRecipes
      .map((recipe) => (recipe.action === "recall_scene" ? recipe.targets?.[0]?.name : null))
      .find(Boolean) ?? null;
  const rooms = pickableGroups(snapshot);
  const room = page?.group ? rooms.find((item) => item.id === page.group?.rid) : undefined;

  function setPages(nextPages: SwitchPage[], nextRecipes = recipes) {
    onChange({
      ...draft,
      pages: nextPages.map((item, index) => ({ ...item, sortOrder: index })),
      recipes: nextRecipes,
    });
  }

  function selectPage(id: string, index = pages.findIndex((item) => item.id === id)) {
    setSelectedPage({ id, index });
    setAddingPage(false);
    setConfirmDelete(false);
    onOpenGesture(null);
  }

  function createPage(pickedRoom: Room) {
    const group = pageGroupFromRoom(pickedRoom);
    if (!group || pages.length >= MAX_ROUND_PAGES) return;
    const id = nextDraftPageId();
    setPages(
      [
        ...pages,
        {
          id,
          name: pageNameFromGroup(pickedRoom.name),
          sortOrder: pages.length,
          theme: "ember",
          group,
          dim: null,
        },
      ],
      [...recipes, ...defaultRecipes(id, group)],
    );
    selectPage(id, pages.length);
  }

  function changeGroup(roomId: string) {
    if (!page) return;
    const picked = rooms.find((item) => item.id === roomId);
    const group = picked ? pageGroupFromRoom(picked) : null;
    if (!picked || !group || page.group?.rid === group.rid) return;
    setPages(
      pages.map((item) => (item.id === page.id ? { ...item, group } : item)),
      [...recipes.filter((recipe) => recipe.pageId !== page.id), ...defaultRecipes(page.id, group)],
    );
    onOpenGesture(null);
    onNotice(`Gestures reset for ${picked.name}: tap toggles it, double tap turns it off.`);
  }

  function deletePage() {
    if (!page || pages.length <= 1) return;
    const remaining = pages.filter((item) => item.id !== page.id);
    setPages(
      remaining,
      recipes.filter((recipe) => recipe.pageId !== page.id),
    );
    const index = Math.max(0, pageIndex - 1);
    selectPage(remaining[index].id, index);
  }

  function movePage(dir: -1 | 1) {
    if (!page) return;
    setPages(moveItem(pages, pageIndex, dir));
    setSelectedPage({ id: page.id, index: pageIndex + dir });
  }

  function patchPage(patch: Partial<SwitchPage>) {
    if (!page) return;
    setPages(pages.map((item) => (item.id === page.id ? { ...item, ...patch } : item)));
  }

  function setRecipe(event: RoundEvent, next: RoundRecipe | null) {
    if (!page) return;
    const without = recipes.filter(
      (recipe) => !(recipe.pageId === page.id && recipe.event === event),
    );
    onChange({ ...draft, recipes: next ? [...without, next] : without });
  }

  function setAction(event: RoundEvent, action: GestureAction) {
    if (!page?.group) return;
    const current = findRoundRecipe(recipes, page.id, event);
    if (action === "none") {
      setRecipe(event, null);
    } else if (action === "scenes") {
      setRecipe(event, {
        pageId: page.id,
        event,
        action: "recall_scene",
        targets: current?.action === "recall_scene" ? (current.targets ?? []) : [],
      });
    } else if (action === "toggle" || action === "on" || action === "off") {
      setRecipe(event, {
        pageId: page.id,
        event,
        action,
        target: targetInGroup(current?.target, page.group, snapshot),
      });
    }
  }

  function setTarget(event: RoundEvent, target: RecipeTarget) {
    const current = page ? findRoundRecipe(recipes, page.id, event) : undefined;
    if (!current || current.action === "recall_scene") return;
    setRecipe(event, { ...current, target });
  }

  function setScenes(event: RoundEvent, targets: SceneListItem[]) {
    if (!page) return;
    setRecipe(event, { pageId: page.id, event, action: "recall_scene", targets });
  }

  const dim = page ? computeDim(pageRecipes, page.group?.groupedLightRid, snapshot) : null;
  const ringText =
    dim?.mode === "group"
      ? `Dims ${room?.name ?? "the group"} (lights that are on)`
      : dim?.mode === "lights"
        ? `Dims ${lightList(dim.rids.map((rid) => snapshot.lights.find((light) => light.id === rid)?.name ?? "a light"))}`
        : "Unused";

  return (
    <div className="border-t border-line">
      <div className="flex flex-wrap">
        <div className="flex max-w-full flex-[1_1_300px] flex-col items-center gap-5 bg-background px-6 py-7">
          {page ? (
            <>
              <RoundDial
                theme={page.theme}
                name={page.name}
                scene={sample}
                pageCount={pages.length}
                activeIndex={pageIndex}
                on={previewOn}
                size={BIG_DIAL}
              />
              <button
                type="button"
                onClick={() => setPreviewOn((on) => !on)}
                className="rounded-full border border-line bg-cream px-2.5 py-[3px] text-xs text-muted"
              >
                Preview · lights {previewOn ? "on" : "off"}
              </button>
              <Link
                href="/how-to?product=round&topic=status"
                className="text-xs text-filament underline underline-offset-2"
              >
                What the screen shows
              </Link>
            </>
          ) : null}

          <div className="flex w-full flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Pages
              </span>
              <span className="text-xs text-muted">
                {pages.length} of {MAX_ROUND_PAGES}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {pages.map((item) => {
                const active = item.id === page?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectPage(item.id)}
                    aria-current={active ? "true" : undefined}
                    className="flex w-[68px] flex-col items-center gap-1.5"
                  >
                    <span
                      className={`block rounded-full border-2 p-[3px] ${
                        active ? "border-filament" : "border-transparent"
                      }`}
                    >
                      <RoundDial
                        theme={item.theme}
                        name={item.name}
                        pageCount={0}
                        activeIndex={0}
                        on
                        size={STRIP_DIAL}
                      />
                    </span>
                    <span
                      className={`max-w-full truncate text-xs ${
                        active ? "text-foreground" : "text-muted"
                      }`}
                    >
                      {item.name || "Page"}
                    </span>
                  </button>
                );
              })}
              {pages.length < MAX_ROUND_PAGES ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddingPage(true);
                    setConfirmDelete(false);
                    onOpenGesture(null);
                  }}
                  className="flex w-[68px] flex-col items-center gap-1.5"
                >
                  <span className="grid h-[62px] w-[62px] place-items-center rounded-full border-[1.5px] border-dashed border-line text-[22px] leading-none text-muted">
                    +
                  </span>
                  <span className="text-xs text-filament">Add page</span>
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {confirmDelete && page ? (
                <>
                  <span className="text-danger">Delete {page.name || "this page"} and its gestures?</span>
                  <button
                    type="button"
                    onClick={() => {
                      deletePage();
                      setConfirmDelete(false);
                    }}
                    className="font-medium text-danger"
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pageIndex === 0}
                    onClick={() => movePage(-1)}
                    className="disabled:opacity-35"
                  >
                    ← Move
                  </button>
                  <button
                    type="button"
                    disabled={pageIndex >= pages.length - 1}
                    onClick={() => movePage(1)}
                    className="disabled:opacity-35"
                  >
                    Move →
                  </button>
                  <button
                    type="button"
                    disabled={pages.length <= 1}
                    onClick={() => setConfirmDelete(true)}
                    className="hover:text-danger disabled:opacity-35 disabled:hover:text-muted"
                  >
                    Delete page
                  </button>
                </>
              )}
            </div>
          </div>

          {page ? (
            <div className="flex w-full flex-col gap-2.5 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setThemeOpen((open) => !open)}
                aria-expanded={themeOpen}
                className="flex items-center gap-2 text-left"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  Theme
                </span>
                <span className="text-sm font-medium">{roundThemeById(page.theme).name}</span>
                <span className="ml-auto text-xs text-filament">{themeOpen ? "Done" : "Change"}</span>
              </button>
              {themeOpen ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                  {ROUND_THEMES.map((theme) => {
                    const selected = page.theme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => patchPage({ theme: theme.id })}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border bg-cream px-1 py-2 ${
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
                          size={THEME_DIAL}
                        />
                        <span className="text-xs font-medium">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-5 p-6">
          {addingPage ? (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.01em]">New page</h3>
                <p className="mt-1 text-sm text-pretty text-muted">
                  Pick a room or zone. Tap will toggle it and double tap will turn
                  it off. You can change both after.
                </p>
              </div>
              <RoomGrid
                snapshot={snapshot}
                onPick={createPage}
                empty="No rooms or zones in this snapshot. A page needs a Hue group."
              />
              <button
                type="button"
                onClick={() => setAddingPage(false)}
                className="self-start text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : page ? (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-[1_1_200px] flex-col gap-1.5">
                  <span className="text-xs text-muted">
                    Page name{" "}
                    <span className="font-mono">
                      · {page.name.length}/{PAGE_NAME_MAX}
                    </span>
                  </span>
                  <input
                    value={page.name}
                    maxLength={PAGE_NAME_MAX}
                    onChange={(event) =>
                      patchPage({ name: foldAscii(event.target.value).slice(0, PAGE_NAME_MAX) })
                    }
                    onBlur={(event) => patchPage({ name: normalizePageName(event.target.value) })}
                    className="border-b border-line bg-transparent pb-1.5 pt-0.5 text-xl font-semibold tracking-[-0.01em] outline-none focus:border-filament"
                  />
                </label>
                <label className="flex flex-[1_1_200px] flex-col gap-1.5">
                  <span className="text-xs text-muted">Room or zone</span>
                  <select
                    value={page.group?.rid ?? ""}
                    onChange={(event) => changeGroup(event.target.value)}
                    className="rounded-md border border-line bg-cream px-2 py-[7px] text-sm outline-none focus:border-filament"
                  >
                    {!page.group ? <option value="">Select a room or zone</option> : null}
                    {page.group && !room ? (
                      <option value={page.group.rid}>Unknown group — pick another</option>
                    ) : null}
                    {rooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.rtype === "zone" ? "zone" : "room"})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {page.group ? (
                <div className="flex flex-col gap-2">
                  {GESTURES.map(({ event, label }) => {
                    const recipe = findRoundRecipe(recipes, page.id, event);
                    const action = recipeAction(recipe);
                    const key = `${page.id}:${event}`;
                    const scenes = recipe?.action === "recall_scene" ? (recipe.targets ?? []) : [];
                    return (
                      <GesturePicker
                        key={key}
                        label={label}
                        summary={summarizeGesture(action, recipe?.target, scenes, snapshot, "Does nothing")}
                        muted={action === "none"}
                        open={openGesture === key}
                        onToggle={() => onOpenGesture(openGesture === key ? null : key)}
                        options={ROUND_OPTIONS}
                        action={action}
                        onAction={(next) => setAction(event, next)}
                        group={page.group as PageGroup}
                        snapshot={snapshot}
                        target={recipe?.target ?? null}
                        onTarget={(target) => setTarget(event, target)}
                        scenes={scenes}
                        onScenes={(next) => setScenes(event, next)}
                      />
                    );
                  })}
                  <p className="mt-1 flex gap-3.5 text-[13px] text-muted">
                    <span className="w-[88px] shrink-0 text-xs font-medium">Ring</span>
                    <span>{ringText}</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Pick a room or zone. Tap will toggle it and double tap will
                  turn it off. You can change both after.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line">
        <button
          type="button"
          onClick={() => setDeviceOpen((open) => !open)}
          aria-expanded={deviceOpen}
          className="flex w-full flex-wrap items-baseline gap-x-3.5 gap-y-1 px-6 py-3.5 text-left"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            Device
          </span>
          <span className="flex-1 text-[13px] text-muted">
            Swipe {draft.pageSwipeAxis === "horizontal" ? "left / right" : "up / down"} between
            pages ·{" "}
            {draft.screenTimeoutSec === 0
              ? "Screen always on"
              : `Screen sleeps after ${draft.screenTimeoutSec} s`}
          </span>
          <span className="text-xs font-medium text-filament">{deviceOpen ? "Done" : "Change"}</span>
        </button>
        {deviceOpen ? (
          <div className="flex flex-wrap gap-6 px-6 pb-[18px]">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Page swipe</span>
              <div className="flex gap-1.5">
                {(
                  [
                    ["horizontal", "Left / right"],
                    ["vertical", "Up / down"],
                  ] as const
                ).map(([axis, label]) => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => onChange({ ...draft, pageSwipeAxis: axis })}
                    className={choiceClass(draft.pageSwipeAxis === axis)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ScreenTimeoutField
              value={draft.screenTimeoutSec}
              onValid={(n) => onChange({ ...draft, screenTimeoutSec: n })}
            />
          </div>
        ) : null}
      </div>
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
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(value);
  const invalid = text !== null && !isScreenTimeoutSec(Number.parseInt(text, 10));

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Screen timeout, seconds</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_SCREEN_TIMEOUT_SEC}
        step={1}
        value={shown}
        aria-invalid={invalid}
        aria-describedby="screen-timeout-hint"
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const n = Number.parseInt(raw, 10);
          if (isScreenTimeoutSec(n)) onValid(n);
        }}
        onBlur={() => setText(null)}
        className={`w-24 rounded-md border bg-cream px-2 py-1.5 text-sm outline-none focus:border-filament ${
          invalid ? "border-danger" : "border-line"
        }`}
      />
      <span
        id="screen-timeout-hint"
        className={`text-xs ${invalid ? "text-danger" : "text-muted"}`}
      >
        {invalid
          ? `Must be 0 (always on) or ${MIN_SCREEN_TIMEOUT_SEC}–${MAX_SCREEN_TIMEOUT_SEC} seconds.`
          : "0 = always on. Not 1–9."}
      </span>
    </label>
  );
}
