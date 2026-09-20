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
  DimTarget,
  HueAction,
  PageSwipeAxis,
  Recipe,
  RecipeTarget,
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

export function groupedLightForScene(
  snapshot: TopologySnapshot,
  sceneRid: string,
): DimTarget | null {
  const scene = snapshot.scenes.find((item) => item.id === sceneRid);
  if (!scene) return null;
  const room = snapshot.rooms.find((item) => item.id === scene.group_rid);
  if (!room?.grouped_light_id) return null;
  return { rtype: "grouped_light", rid: room.grouped_light_id };
}

function dimFromRecipe(
  recipe: RoundRecipe | undefined,
  snapshot: TopologySnapshot,
): DimTarget | null {
  if (!recipe) return null;
  if (recipe.action === "recall_scene") {
    const first = recipe.targets?.[0];
    if (!first) return null;
    return groupedLightForScene(snapshot, first.rid);
  }
  const target = recipe.target;
  if (!target) return null;
  if (target.rtype === "light" || target.rtype === "grouped_light") {
    return { rtype: target.rtype, rid: target.rid };
  }
  return null;
}

/** Spec §8.2: short light/group, else short scene list's group, else the same for double tap. */
export function computeDimTarget(
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot,
): DimTarget | null {
  const short = recipes.find((recipe) => recipe.event === "short");
  const dbl = recipes.find((recipe) => recipe.event === "double_click");
  return dimFromRecipe(short, snapshot) ?? dimFromRecipe(dbl, snapshot);
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
  const dim = computeDimTarget(pageRecipes, snapshot);
  const tapPart = tap
    ? `tap → ${roundActionClause(tap, snapshot)}`
    : "tap → unassigned";
  const dblPart = dbl
    ? `double-tap → ${roundActionClause(dbl, snapshot)}`
    : "double-tap → unassigned";
  const dimName = dim ? nameForTarget(snapshot, dim) : null;
  const ring = dimName ? `ring dims ${dimName}` : "ring unused";
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
      page.sortOrder === other.sortOrder
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
  }

  const seen = new Set<string>();
  const lightIds = new Set(snapshot.lights.map((light) => light.id));
  const groupedIds = new Set(
    snapshot.rooms
      .map((room) => room.grouped_light_id)
      .filter((id): id is string => Boolean(id)),
  );
  const sceneIds = new Set(snapshot.scenes.map((scene) => scene.id));

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

    if (recipe.action === "recall_scene") {
      const targets = recipe.targets ?? [];
      if (targets.length < 1 || targets.length > MAX_SCENE_LIST) {
        return "recall_scene needs 1–8 scenes";
      }
      let group: string | null = null;
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
        if (group && itemGroup !== group) {
          return "Scenes must be in the same room or zone.";
        }
        group = itemGroup;
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
    dimTarget: page.dimTarget,
  };
}

export function defaultRoundPage(id: string, name: string, sortOrder: number): SwitchPage {
  return {
    id,
    name,
    sortOrder,
    theme: DEFAULT_ROUND_THEME,
    dimTarget: null,
  };
}

export function isRoundEvent(value: unknown): value is RoundEvent {
  return value === "short" || value === "double_click";
}

export function isPageSwipeAxis(value: unknown): value is PageSwipeAxis {
  return value === "horizontal" || value === "vertical";
}
