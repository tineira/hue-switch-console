import {
  DEFAULT_ROUND_THEME,
  MAX_ROUND_PAGES,
  MAX_SCENE_LIST,
  PAGE_NAME_MAX,
  isRoundThemeId,
  normalizeRoundTheme,
} from "@/lib/round-themes";
import {
  actionClause,
  isTargetStale,
  nameForTarget,
} from "@/lib/recipes";
import type {
  Channel,
  DimSet,
  HueAction,
  PageGroup,
  PageSwipeAxis,
  Recipe,
  RecipeTarget,
  Room,
  RoundEvent,
  RoundRecipe,
  SceneListItem,
  SwitchPage,
  SwitchProduct,
  TopologySnapshot,
} from "@/lib/types";

export {
  DEFAULT_ROUND_THEME,
  MAX_ROUND_PAGES,
  MAX_SCENE_LIST,
  PAGE_NAME_MAX,
  normalizeRoundTheme,
};

export const ROUND_EVENTS: RoundEvent[] = ["short", "double_click"];

export const DEFAULT_SCREEN_TIMEOUT_SEC = 30;
export const MIN_SCREEN_TIMEOUT_SEC = 10;
export const MAX_SCREEN_TIMEOUT_SEC = 600;

export function isPlaceholderRoundChannels(channels: Channel[]): boolean {
  if (channels.length === 0) return true;
  if (channels.length !== 1) return false;
  const channel = channels[0];
  return channel.id === "c1";
}

export function inferProduct(
  product: SwitchProduct | undefined,
  channels: Channel[],
): SwitchProduct {
  if (product === "round" || product === "simple") return product;
  return isPlaceholderRoundChannels(channels) ? "round" : "simple";
}

export function roundEventLabel(event: RoundEvent): string {
  return event === "double_click" ? "Double tap" : "Tap";
}

export function defaultRoundActionForTarget(
  event: RoundEvent,
  rtype: RecipeTarget["rtype"],
): HueAction {
  if (rtype === "scene") return "recall_scene";
  return event === "double_click" ? "off" : "toggle";
}

export function findRoundRecipe(
  recipes: RoundRecipe[],
  pageId: string,
  event: RoundEvent,
): RoundRecipe | undefined {
  return recipes.find(
    (recipe) => recipe.pageId === pageId && recipe.event === event,
  );
}

export function upsertRoundRecipe(
  recipes: RoundRecipe[],
  next: RoundRecipe,
): RoundRecipe[] {
  return [
    ...recipes.filter(
      (recipe) =>
        !(recipe.pageId === next.pageId && recipe.event === next.event),
    ),
    next,
  ];
}

export function clearRoundRecipe(
  recipes: RoundRecipe[],
  pageId: string,
  event: RoundEvent,
): RoundRecipe[] {
  return recipes.filter(
    (recipe) => !(recipe.pageId === pageId && recipe.event === event),
  );
}

export function sceneGroupRid(
  snapshot: TopologySnapshot,
  sceneRid: string,
): string | null {
  return snapshot.scenes.find((scene) => scene.id === sceneRid)?.group_rid ?? null;
}

export function foldAscii(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** ASCII fold + 12-char disk limit. Empty after fold → "Page". */
export function normalizePageName(input: string): string {
  const folded = foldAscii(input).slice(0, PAGE_NAME_MAX).trim();
  return folded || "Page";
}

export function pageNameWouldTruncate(input: string): boolean {
  return foldAscii(input).length > PAGE_NAME_MAX;
}

export function pageNameFromGroup(name: string): string {
  return normalizePageName(name);
}

export function pageGroupFromRoom(room: Room): PageGroup | null {
  if (!room.grouped_light_id) return null;
  return {
    rtype: room.rtype === "zone" ? "zone" : "room",
    rid: room.id,
    groupedLightRid: room.grouped_light_id,
  };
}

export function pickableGroups(snapshot: TopologySnapshot): Room[] {
  return snapshot.rooms.filter((room) => Boolean(room.grouped_light_id));
}

export function resolvePageGroup(
  snapshot: TopologySnapshot,
  group: PageGroup | null | undefined,
): PageGroup | null {
  if (!group?.rid) return null;
  const room = snapshot.rooms.find((item) => item.id === group.rid);
  return room ? pageGroupFromRoom(room) : null;
}

export function groupsEqual(
  a: PageGroup | null | undefined,
  b: PageGroup | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.rtype === b.rtype &&
    a.rid === b.rid &&
    a.groupedLightRid === b.groupedLightRid
  );
}

export function dimsEqual(a: DimSet | null | undefined, b: DimSet | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;
  if (a.mode === "group" && b.mode === "group") return a.rid === b.rid;
  if (a.mode === "lights" && b.mode === "lights") {
    return (
      a.rids.length === b.rids.length &&
      a.rids.every((rid, index) => rid === b.rids[index])
    );
  }
  return false;
}

export function roomForGroup(
  snapshot: TopologySnapshot,
  groupRid: string,
): Room | undefined {
  return snapshot.rooms.find((room) => room.id === groupRid);
}

export function targetBelongsToGroup(
  target: RecipeTarget,
  group: PageGroup,
  snapshot: TopologySnapshot,
): boolean {
  if (target.rtype === "grouped_light") {
    return target.rid === group.groupedLightRid;
  }
  if (target.rtype === "light") {
    const room = roomForGroup(snapshot, group.rid);
    return Boolean(room?.light_ids?.includes(target.rid));
  }
  if (target.rtype === "scene") {
    return sceneGroupRid(snapshot, target.rid) === group.rid;
  }
  return false;
}

export function recipeBelongsToGroup(
  recipe: RoundRecipe,
  group: PageGroup,
  snapshot: TopologySnapshot,
): boolean {
  if (recipe.action === "recall_scene") {
    const targets = recipe.targets ?? [];
    return (
      targets.length > 0 &&
      targets.every((item) =>
        targetBelongsToGroup({ rtype: "scene", rid: item.rid }, group, snapshot),
      )
    );
  }
  return recipe.target
    ? targetBelongsToGroup(recipe.target, group, snapshot)
    : false;
}

/** Drop tap/double targets that are not in the page's room or zone. */
export function recipesForGroup(
  recipes: RoundRecipe[],
  pageId: string,
  group: PageGroup,
  snapshot: TopologySnapshot,
): RoundRecipe[] {
  const next: RoundRecipe[] = [];
  for (const recipe of recipes) {
    if (recipe.pageId !== pageId) {
      next.push(recipe);
      continue;
    }
    if (recipe.action === "recall_scene") {
      const targets = (recipe.targets ?? []).filter((item) =>
        targetBelongsToGroup({ rtype: "scene", rid: item.rid }, group, snapshot),
      );
      if (targets.length > 0) next.push({ ...recipe, targets });
      continue;
    }
    if (recipe.target && targetBelongsToGroup(recipe.target, group, snapshot)) {
      next.push(recipe);
    }
  }
  return next;
}

function groupFromTarget(
  snapshot: TopologySnapshot,
  target: RecipeTarget | undefined,
): PageGroup | null {
  if (!target) return null;
  if (target.rtype === "light") {
    const room = snapshot.rooms.find((item) =>
      (item.light_ids ?? []).includes(target.rid),
    );
    return room ? pageGroupFromRoom(room) : null;
  }
  if (target.rtype === "grouped_light") {
    const room = snapshot.rooms.find(
      (item) => item.grouped_light_id === target.rid,
    );
    return room ? pageGroupFromRoom(room) : null;
  }
  if (target.rtype === "scene") {
    const groupRid = sceneGroupRid(snapshot, target.rid);
    if (!groupRid) return null;
    const room = roomForGroup(snapshot, groupRid);
    return room ? pageGroupFromRoom(room) : null;
  }
  return null;
}

function groupFromRecipe(
  recipe: RoundRecipe | undefined,
  snapshot: TopologySnapshot,
): PageGroup | null {
  if (!recipe) return null;
  if (recipe.action === "recall_scene") {
    const first = recipe.targets?.[0];
    if (!first) return null;
    return groupFromTarget(snapshot, { rtype: "scene", rid: first.rid });
  }
  return groupFromTarget(snapshot, recipe.target);
}

/** Spec §14: light → its room, scene → its group, grouped_light → that group. */
export function inferPageGroup(
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): PageGroup | null {
  const short = recipes.find((recipe) => recipe.event === "short");
  const dbl = recipes.find((recipe) => recipe.event === "double_click");
  return groupFromRecipe(short, snapshot) ?? groupFromRecipe(dbl, snapshot);
}

function lightHasDimCap(
  snapshot: TopologySnapshot | null | undefined,
  rid: string,
): boolean {
  if (!snapshot) return true;
  const light = snapshot.lights.find((item) => item.id === rid);
  if (!light) return true;
  if (!Array.isArray(light.caps)) return true;
  return light.caps.includes("dim");
}

/**
 * Spec §8.2, in order: scene → group; any grouped_light of the page → group;
 * only child lights → those lights; else null. Tap=lamp + double=off group → group.
 * grouped_light counts as dimmable. lights mode: exclude only when `caps` is an
 * array that lacks `"dim"`. Missing `caps` (old snapshot) stays dimmable.
 */
export function computeDim(
  recipes: RoundRecipe[],
  groupedLightRid: string | null | undefined,
  snapshot?: TopologySnapshot | null,
): DimSet | null {
  const tap = recipes.find((recipe) => recipe.event === "short");
  const dbl = recipes.find((recipe) => recipe.event === "double_click");
  const slots = [tap, dbl].filter((recipe): recipe is RoundRecipe => Boolean(recipe));
  const groupRid =
    groupedLightRid ||
    slots.find((recipe) => recipe.target?.rtype === "grouped_light")?.target?.rid;
  if (slots.some((recipe) => recipe.action === "recall_scene")) {
    return groupRid ? { mode: "group", rid: groupRid } : null;
  }
  if (
    slots.some(
      (recipe) =>
        recipe.target?.rtype === "grouped_light" &&
        (!groupedLightRid || recipe.target.rid === groupedLightRid),
    )
  ) {
    return groupRid ? { mode: "group", rid: groupRid } : null;
  }
  const rids: string[] = [];
  for (const recipe of slots) {
    if (recipe.target?.rtype !== "light") return null;
    if (!rids.includes(recipe.target.rid)) rids.push(recipe.target.rid);
  }
  if (rids.length === 0) return null;
  const dimmable = rids.filter((rid) => lightHasDimCap(snapshot, rid));
  if (dimmable.length === 0) return null;
  return { mode: "lights", rids: dimmable };
}

export function sceneListItem(
  snapshot: TopologySnapshot,
  rid: string,
  fallbackName = "",
): SceneListItem {
  const scene = snapshot.scenes.find((item) => item.id === rid);
  return {
    rtype: "scene",
    rid,
    name: scene?.name ?? fallbackName,
  };
}

export function withSceneNames(
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): RoundRecipe[] {
  return recipes.map((recipe) => {
    if (recipe.action !== "recall_scene" || !recipe.targets?.length) {
      return recipe;
    }
    return {
      ...recipe,
      targets: recipe.targets.map((item) =>
        sceneListItem(snapshot, item.rid, item.name),
      ),
    };
  });
}

function roundActionClause(
  recipe: RoundRecipe,
  snapshot: TopologySnapshot,
): string {
  if (recipe.action === "recall_scene") {
    const names = (recipe.targets ?? []).map(
      (item) =>
        item.name ||
        nameForTarget(snapshot, { rtype: "scene", rid: item.rid }) ||
        "unknown target",
    );
    if (names.length === 0) return "scene unknown target";
    if (names.length === 1) return `scene ${names[0]}`;
    return `cycle ${names.join(", ")}`;
  }
  const target = recipe.target;
  const name = target
    ? nameForTarget(snapshot, target) ?? "unknown target"
    : "unknown target";
  return actionClause(recipe.action, name);
}

export function confirmationForPage(
  page: SwitchPage,
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): string {
  const pageRecipes = recipes.filter((recipe) => recipe.pageId === page.id);
  const tap = findRoundRecipe(pageRecipes, page.id, "short");
  const dbl = findRoundRecipe(pageRecipes, page.id, "double_click");
  const dim = computeDim(pageRecipes, page.group?.groupedLightRid, snapshot);
  const tapPart = tap
    ? `tap → ${roundActionClause(tap, snapshot)}`
    : "tap → unassigned";
  const dblPart = dbl
    ? `double-tap → ${roundActionClause(dbl, snapshot)}`
    : "double-tap → unassigned";
  let ring = "ring unused";
  if (dim?.mode === "group") {
    const name =
      nameForTarget(snapshot, { rtype: "grouped_light", rid: dim.rid }) ??
      "the room";
    ring = `ring dims ${name} (on lights)`;
  } else if (dim?.mode === "lights") {
    ring = "ring dims those lights";
  }
  return `${page.name} · ${tapPart} · ${dblPart} · ${ring}`;
}

export function isRoundRecipeStale(
  recipe: RoundRecipe,
  snapshot: TopologySnapshot,
): boolean {
  if (recipe.action === "recall_scene") {
    return (recipe.targets ?? []).some((item) =>
      isTargetStale(snapshot, { rtype: "scene", rid: item.rid }),
    );
  }
  return recipe.target ? isTargetStale(snapshot, recipe.target) : true;
}

export function staleRoundCount(
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): number {
  let count = 0;
  for (const recipe of recipes) {
    if (recipe.action === "recall_scene") {
      count += (recipe.targets ?? []).filter((item) =>
        isTargetStale(snapshot, { rtype: "scene", rid: item.rid }),
      ).length;
    } else if (recipe.target && isTargetStale(snapshot, recipe.target)) {
      count += 1;
    }
  }
  return count;
}

export function clearStaleRoundRecipes(
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): RoundRecipe[] {
  const next: RoundRecipe[] = [];
  for (const recipe of recipes) {
    if (recipe.action === "recall_scene") {
      const targets = (recipe.targets ?? []).filter(
        (item) => !isTargetStale(snapshot, { rtype: "scene", rid: item.rid }),
      );
      if (targets.length === 0) continue;
      next.push({ ...recipe, targets });
      continue;
    }
    if (recipe.target && !isTargetStale(snapshot, recipe.target)) {
      next.push(recipe);
    }
  }
  return next;
}

export function pagesEqual(a: SwitchPage[], b: SwitchPage[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((page, index) => {
    const other = b[index];
    return (
      page.id === other.id &&
      page.name === other.name &&
      page.theme === other.theme &&
      page.sortOrder === other.sortOrder &&
      groupsEqual(page.group, other.group)
    );
  });
}

export function roundRecipesEqual(a: RoundRecipe[], b: RoundRecipe[]): boolean {
  const serialize = (list: RoundRecipe[]) =>
    [...list]
      .map((recipe) => {
        if (recipe.action === "recall_scene") {
          const targets = (recipe.targets ?? [])
            .map((item) => item.rid)
            .join(",");
          return `${recipe.pageId}|${recipe.event}|${recipe.action}|${targets}`;
        }
        return `${recipe.pageId}|${recipe.event}|${recipe.action}|${recipe.target?.rtype ?? ""}|${recipe.target?.rid ?? ""}`;
      })
      .sort()
      .join(";");
  return serialize(a) === serialize(b);
}

export function nextPageName(pages: SwitchPage[]): string {
  const n = pages.length + 1;
  const name = `Page ${n}`;
  return name.slice(0, PAGE_NAME_MAX);
}

export function validateRoundConfig(
  pages: SwitchPage[],
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): string | null {
  if (pages.length < 1) return "a round display needs at least one page";
  if (pages.length > MAX_ROUND_PAGES) {
    return `at most ${MAX_ROUND_PAGES} pages`;
  }
  if (recipes.length > MAX_ROUND_PAGES * 2) {
    return "at most 12 recipes on a round display";
  }

  const pageIds = new Set<string>();
  for (const page of pages) {
    if (!page.id) return "page id is required";
    if (pageIds.has(page.id)) return `duplicate page id ${page.id}`;
    pageIds.add(page.id);
    const name = page.name.trim();
    if (name.length < 1 || name.length > PAGE_NAME_MAX) {
      return `page name must be 1–${PAGE_NAME_MAX} characters`;
    }
    if (!isRoundThemeId(page.theme)) {
      return `unknown theme ${page.theme}`;
    }
    const resolved = resolvePageGroup(snapshot, page.group);
    if (!page.group) {
      return `page ${page.name} needs a room or zone`;
    }
    if (!resolved) {
      return `unknown room or zone for page ${page.name}`;
    }
    if (page.group.rtype !== "room" && page.group.rtype !== "zone") {
      return `group rtype must be room or zone`;
    }
  }

  const seen = new Set<string>();
  const lightIds = new Set(snapshot.lights.map((light) => light.id));
  const groupedIds = new Set(
    snapshot.rooms
      .map((room) => room.grouped_light_id)
      .filter((id): id is string => Boolean(id)),
  );
  const sceneIds = new Set(snapshot.scenes.map((scene) => scene.id));
  const pageById = new Map(pages.map((page) => [page.id, page]));

  for (const recipe of recipes) {
    const key = `${recipe.pageId}:${recipe.event}`;
    if (seen.has(key)) return `duplicate recipe for ${key}`;
    seen.add(key);
    if (!pageIds.has(recipe.pageId)) {
      return `unknown pageId ${recipe.pageId}`;
    }
    if (recipe.event !== "short" && recipe.event !== "double_click") {
      return `event ${recipe.event} is not valid for a round page`;
    }
    const page = pageById.get(recipe.pageId);
    const group = page ? resolvePageGroup(snapshot, page.group) : null;
    if (!group) {
      return `page ${page?.name ?? recipe.pageId} needs a room or zone`;
    }

    if (recipe.action === "recall_scene") {
      const targets = recipe.targets ?? [];
      if (targets.length < 1 || targets.length > MAX_SCENE_LIST) {
        return "recall_scene needs 1–8 scenes";
      }
      for (const item of targets) {
        if (item.rtype !== "scene") {
          return "recall_scene targets must be scenes";
        }
        if (!sceneIds.has(item.rid)) {
          return `unknown scene rid ${item.rid}`;
        }
        const itemGroup = sceneGroupRid(snapshot, item.rid);
        if (!itemGroup) {
          return `scene ${item.rid} has no room or zone`;
        }
        if (itemGroup !== group.rid) {
          return "Scenes must belong to the page's room or zone.";
        }
      }
    } else {
      const target = recipe.target;
      if (!target) return `${recipe.action} requires a target`;
      if (target.rtype === "scene") {
        return `${recipe.action} cannot target a scene`;
      }
      if (target.rtype === "light" && !lightIds.has(target.rid)) {
        return `unknown light rid ${target.rid}`;
      }
      if (target.rtype === "grouped_light" && !groupedIds.has(target.rid)) {
        return `unknown grouped_light rid ${target.rid}`;
      }
      if (!targetBelongsToGroup(target, group, snapshot)) {
        return "Recipes must belong to the page's room or zone.";
      }
    }
  }
  return null;
}

export function recipeToC1(recipe: Recipe): RoundRecipe {
  if (recipe.action === "recall_scene") {
    return {
      pageId: "p1",
      event: recipe.event === "double_click" ? "double_click" : "short",
      action: "recall_scene",
      targets: [
        {
          rtype: "scene",
          rid: recipe.target.rid,
          name: "",
        },
      ],
    };
  }
  return {
    pageId: "p1",
    event: recipe.event === "double_click" ? "double_click" : "short",
    action: recipe.action,
    target: recipe.target,
  };
}

export function deviceRoundRecipe(recipe: RoundRecipe): Record<string, unknown> {
  if (recipe.action === "recall_scene") {
    return {
      pageId: recipe.pageId,
      event: recipe.event,
      action: recipe.action,
      targets: (recipe.targets ?? []).map((item) => ({
        rtype: "scene" as const,
        rid: item.rid,
        name: item.name,
      })),
    };
  }
  return {
    pageId: recipe.pageId,
    event: recipe.event,
    action: recipe.action,
    target: recipe.target,
  };
}

export function deviceRoundPage(page: SwitchPage): Record<string, unknown> {
  return {
    id: page.id,
    name: page.name,
    theme: normalizeRoundTheme(page.theme),
    group: page.group
      ? {
          rtype: page.group.rtype,
          rid: page.group.rid,
          groupedLightRid: page.group.groupedLightRid,
        }
      : null,
    dim: page.dim,
  };
}

export function defaultRoundPage(
  id: string,
  name: string,
  sortOrder: number,
  group: PageGroup | null = null,
): SwitchPage {
  return {
    id,
    name,
    sortOrder,
    theme: DEFAULT_ROUND_THEME,
    group,
    dim: null,
  };
}

export function isRoundEvent(value: unknown): value is RoundEvent {
  return value === "short" || value === "double_click";
}

export function isPageSwipeAxis(value: unknown): value is PageSwipeAxis {
  return value === "horizontal" || value === "vertical";
}

export function isScreenTimeoutSec(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (value === 0 ||
      (value >= MIN_SCREEN_TIMEOUT_SEC && value <= MAX_SCREEN_TIMEOUT_SEC))
  );
}
