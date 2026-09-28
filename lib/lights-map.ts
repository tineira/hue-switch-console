// The Lights map model: who reaches which light, room and zone. A port of the logic in
// docs/specs/finished/design_handoff_lights_map/ (`build`, `reach`, `lines` and the phrase
// helpers), fed from a Bridge snapshot and its switches' saved configuration.

import { agoText, minutesSince } from "@/lib/ago";
import type { BridgeSwitch, LoadedBridge } from "@/lib/bridge-switches";
import { formatMac } from "@/lib/mac";
import { computeDim } from "@/lib/pages";
import { kindLabel } from "@/lib/simple-channels";
import type {
  RecipeTarget,
  RoundRecipe,
  SceneListItem,
  SimpleGesture,
  TopologySnapshot,
} from "@/lib/types";

/** Lighting acts. Nothing, and BOOT's re-pair, are not lighting and never become a Gesture. */
export type Act = "toggle" | "dim" | "scenes" | "onoff" | "on" | "off";

export type Target =
  | { k: "l"; ids: string[] }
  | { k: "g"; key: string }
  | { k: "x"; id: string; type: "light" | "room" | "zone" | "room or zone" | "scene" };

/** A Round page or a Simple input. Round pages and named Simple switches have a `title`, and show as chips. */
export type Unit = { ctx: string; title: string | null; sub: string };

export type MapSwitch = {
  id: string;
  name: string;
  product: "Round" | "Simple";
  meta: string;
  units: Unit[];
  named: boolean;
  hue: number;
};

export type Gesture = {
  sw: MapSwitch;
  u: Unit;
  name: string;
  act: Act;
  t: Target;
  /** Scene names, for `scenes`. */
  sc: string[];
  who: string;
};

export type MapGroup = {
  key: string;
  name: string;
  type: "room" | "zone";
  /** Light ids. */
  lights: string[];
  /** Scene names. */
  scenes: string[];
  all: boolean;
};

export type LightStatus = "direct" | "via" | "none";

export type MapLight = {
  id: string;
  name: string;
  /** Room key. */
  room: string;
  color: boolean;
  on: boolean;
  /** Zone keys. */
  zones: string[];
  direct: Gesture[];
  via: Record<string, Gesture[]>;
  /** Group keys, smallest group first. */
  viaGroups: string[];
  status: LightStatus;
};

export type LightsModel = {
  bridge: LoadedBridge;
  lights: Record<string, MapLight>;
  groups: MapGroup[];
  gmap: Record<string, MapGroup>;
  rooms: MapGroup[];
  zones: MapGroup[];
  switches: MapSwitch[];
  gestures: Gesture[];
  groupCtl: Record<string, Gesture[]>;
  sceneUse: Record<string, Gesture[]>;
  stale: Gesture[];
  nScenes: number;
};

const SW_HUES = [250, 145, 330, 75, 195, 20, 285, 110];

/** The switch's colour; lightness and chroma follow the theme (`--switch-l`, `--switch-c`). */
export function switchColor(sw: MapSwitch): string {
  return `oklch(var(--switch-l) var(--switch-c) ${sw.hue})`;
}

export const plural = (n: number, one: string, many?: string) =>
  `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export function buildLightsModel(bridge: LoadedBridge, items: BridgeSwitch[]): LightsModel {
  const snapshot = bridge.snapshot;
  const known = new Map(snapshot.lights.map((light) => [light.id, light]));
  const lights: Record<string, MapLight> = {};
  const groups: MapGroup[] = [];
  const gmap: Record<string, MapGroup> = {};
  const byGroupedLight = new Map<string, string>();
  const byRid = new Map<string, string>();

  const snapshotRooms = snapshot.rooms.filter((room) => room.rtype !== "zone").sort(byName);
  const snapshotZones = snapshot.rooms.filter((room) => room.rtype === "zone").sort(byName);
  const scenesOf = (rid: string) =>
    snapshot.scenes.filter((scene) => scene.group_rid === rid).map((scene) => scene.name);

  const addLight = (id: string, room: string) => {
    const light = known.get(id);
    if (!light || lights[id]) return false;
    lights[id] = {
      id,
      name: light.name,
      room,
      color: (light.caps ?? []).includes("color"),
      on: light.on === true,
      zones: [],
      direct: [],
      via: {},
      viaGroups: [],
      status: "none",
    };
    return true;
  };

  for (const room of snapshotRooms) {
    const key = `r:${room.id}`;
    const group: MapGroup = {
      key,
      name: room.name,
      type: "room",
      lights: (room.light_ids ?? []).filter((id) => addLight(id, key)),
      scenes: scenesOf(room.id),
      all: false,
    };
    groups.push(group);
    gmap[key] = group;
    byRid.set(room.id, key);
    if (room.grouped_light_id) byGroupedLight.set(room.grouped_light_id, key);
  }
  // Every light belongs to one room; a snapshot that disagrees gets a stand-in.
  const roomless = snapshot.lights.filter((light) => !lights[light.id]);
  if (roomless.length > 0) {
    const key = "r:_none";
    const group: MapGroup = {
      key,
      name: "Not in a room",
      type: "room",
      lights: roomless.filter((light) => addLight(light.id, key)).map((light) => light.id),
      scenes: [],
      all: false,
    };
    groups.push(group);
    gmap[key] = group;
  }
  const total = Object.keys(lights).length;
  for (const zone of snapshotZones) {
    const key = `z:${zone.id}`;
    const ids = (zone.light_ids ?? []).filter((id) => lights[id]);
    const group: MapGroup = {
      key,
      name: zone.name,
      type: "zone",
      lights: ids,
      scenes: scenesOf(zone.id),
      all: total > 0 && ids.length === total,
    };
    groups.push(group);
    gmap[key] = group;
    byRid.set(zone.id, key);
    if (zone.grouped_light_id) byGroupedLight.set(zone.grouped_light_id, key);
    for (const id of ids) lights[id].zones.push(key);
  }

  // `kind` names a missing group after the input's own room or zone, when known.
  const target = (
    t: RecipeTarget | undefined | null,
    kind?: "room" | "zone",
  ): Target | null => {
    if (!t) return null;
    if (t.rtype === "grouped_light") {
      const key = byGroupedLight.get(t.rid);
      return key ? { k: "g", key } : { k: "x", id: t.rid, type: kind ?? "room or zone" };
    }
    if (t.rtype === "light") {
      return lights[t.rid] ? { k: "l", ids: [t.rid] } : { k: "x", id: t.rid, type: "light" };
    }
    return null;
  };
  const sceneNames = new Map(snapshot.scenes.map((scene) => [scene.id, scene.name]));
  // A scene list acts on the group its scenes belong to.
  const scenesTarget = (
    group: { rid: string; rtype: "room" | "zone" } | null | undefined,
    list: SceneListItem[],
  ): Target => {
    const key = group ? byRid.get(group.rid) : undefined;
    if (!key) return { k: "x", id: group?.rid ?? "", type: group?.rtype ?? "room or zone" };
    const missing = list.find((item) => !sceneNames.has(item.rid));
    return missing ? { k: "x", id: missing.rid, type: "scene" } : { k: "g", key };
  };
  const names = (list: SceneListItem[]) => list.map((item) => sceneNames.get(item.rid) ?? item.name);

  const switches: MapSwitch[] = [];
  const gestures: Gesture[] = [];
  items.forEach((item, index) => {
    const round = item.product === "round";
    const seen = minutesSince(item.last_seen_at);
    const sw: MapSwitch = {
      id: item.mac,
      name: item.label?.trim() || formatMac(item.mac),
      product: round ? "Round" : "Simple",
      meta: [
        item.firmware ? `Firmware ${item.firmware}` : null,
        seen === null ? "never seen" : `seen ${agoText(seen)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      units: [],
      named: round && item.pages.length > 0,
      hue: SW_HUES[index % SW_HUES.length],
    };
    switches.push(sw);
    const add = (u: Unit, name: string, act: Act, t: Target | null, sc: string[] = []) => {
      if (!t) return;
      gestures.push({ sw, u, name, act, t, sc, who: `${sw.name} · ${u.ctx}` });
    };

    if (round) {
      item.pages.forEach((page, i) => {
        const u: Unit = { ctx: `page ${page.name}`, title: page.name, sub: `Page ${i + 1}` };
        sw.units.push(u);
        const recipes = item.roundRecipes.filter((recipe) => recipe.pageId === page.id);
        const roundGesture = (name: string, recipe: RoundRecipe | undefined) => {
          if (!recipe) return;
          if (recipe.action === "recall_scene") {
            const list = recipe.targets ?? [];
            add(u, name, "scenes", scenesTarget(page.group, list), names(list));
          } else {
            add(u, name, recipe.action, target(recipe.target, page.group?.rtype));
          }
        };
        roundGesture("Tap", recipes.find((recipe) => recipe.event === "short"));
        roundGesture("Double tap", recipes.find((recipe) => recipe.event === "double_click"));
        const dim = page.dim ?? computeDim(recipes, page.group?.groupedLightRid, snapshot);
        if (dim?.mode === "group") {
          add(u, "Ring", "dim", target({ rtype: "grouped_light", rid: dim.rid }, page.group?.rtype));
        } else if (dim?.mode === "lights") {
          const ids = dim.rids.filter((id) => lights[id]);
          if (ids.length > 0) add(u, "Ring", "dim", { k: "l", ids });
        }
      });
    } else {
      for (const channel of item.channels) {
        const config = item.simpleChannels.find((candidate) => candidate.id === channel.id);
        if (!config) continue;
        const u: Unit = {
          ctx: channel.label,
          title: config.label,
          sub: `GPIO ${channel.gpio} · ${kindLabel(config.kind)}`,
        };
        sw.units.push(u);
        const simpleGesture = (name: string, gesture: SimpleGesture | null) => {
          if (!gesture) return;
          if (gesture.action === "recall_scene") {
            add(u, name, "scenes", scenesTarget(config.group, gesture.targets), names(gesture.targets));
          } else {
            add(u, name, gesture.action, target(gesture.target, config.group.rtype));
          }
        };
        if (config.kind === "maintained") {
          add(u, "On / Off", "onoff", target(config.target, config.group.rtype));
          if (config.scenes.length > 0) {
            add(u, "Double-click", "scenes", scenesTarget(config.group, config.scenes), names(config.scenes));
          }
        } else {
          add(u, "Click", "toggle", target(config.target, config.group.rtype));
          simpleGesture("Double-click", config.double);
          simpleGesture("Hold", config.hold);
        }
      }
    }
  });

  const direct: Record<string, Gesture[]> = {};
  const via: Record<string, Record<string, Gesture[]>> = {};
  const groupCtl: Record<string, Gesture[]> = {};
  const sceneUse: Record<string, Gesture[]> = {};
  const stale: Gesture[] = [];
  for (const g of gestures) {
    if (g.t.k === "x") {
      stale.push(g);
      continue;
    }
    if (g.t.k === "l") {
      for (const id of g.t.ids) (direct[id] ??= []).push(g);
      continue;
    }
    const key = g.t.key;
    (groupCtl[key] ??= []).push(g);
    for (const id of gmap[key].lights) ((via[id] ??= {})[key] ??= []).push(g);
    if (g.act === "scenes") for (const s of g.sc) (sceneUse[`${key}|${s}`] ??= []).push(g);
  }
  for (const light of Object.values(lights)) {
    light.direct = direct[light.id] ?? [];
    light.via = via[light.id] ?? {};
    light.viaGroups = Object.keys(light.via).sort(
      (a, b) => gmap[a].lights.length - gmap[b].lights.length,
    );
    light.status = light.direct.length ? "direct" : light.viaGroups.length ? "via" : "none";
  }

  return {
    bridge,
    lights,
    groups,
    gmap,
    rooms: groups.filter((group) => group.type === "room"),
    zones: groups.filter((group) => group.type === "zone"),
    switches,
    gestures,
    groupCtl,
    sceneUse,
    stale,
    nScenes: groups.reduce((sum, group) => sum + group.scenes.length, 0),
  };
}

export type Reach = { l: Set<string>; g: Set<string>; lit: Set<string> };

/** Every light the gestures control directly or through a group, plus their rooms. */
export function reach(model: LightsModel, gs: Gesture[]): Reach {
  const r: Reach = { l: new Set(), g: new Set(), lit: new Set() };
  for (const g of gs) {
    if (g.t.k === "x") continue;
    if (g.t.k === "l") {
      for (const id of g.t.ids) {
        r.l.add(id);
        r.lit.add(id);
      }
    } else {
      const group = model.gmap[g.t.key];
      r.g.add(group.key);
      r.lit.add(group.key);
      for (const id of group.lights) r.l.add(id);
    }
  }
  for (const id of r.l) r.g.add(model.lights[id].room);
  return r;
}

// ---- phrases

const scenesTxt = (sc: string[]) =>
  sc.length === 1 ? `recalls ${sc[0]}` : `cycles ${sc.join(" → ")}`;

const VERBS: Record<Exclude<Act, "dim" | "scenes">, string> = {
  toggle: "toggles",
  onoff: "turns on and off",
  on: "turns on",
  off: "turns off",
};

export function verbObj(g: Gesture, obj: string): string {
  if (g.act === "dim") return g.name === "Hold" ? `dims ${obj} while held` : `dims ${obj}`;
  if (g.act === "scenes") return `cycles ${obj}`;
  return `${VERBS[g.act]} ${obj}`;
}

export function phraseGroup(g: Gesture): string {
  return `${g.name} ${g.act === "scenes" ? scenesTxt(g.sc) : verbObj(g, "").trim()}`.replace(
    /\s+while held$/,
    " while held",
  );
}

export function phraseSelf(model: LightsModel, self: string) {
  return (g: Gesture): string => {
    const others = g.t.k === "l" ? g.t.ids.filter((id) => id !== self) : [];
    const with_ = others.map((id) => model.lights[id]?.name ?? id).join(", ");
    return `${g.name} ${verbObj(g, "it")}${others.length ? ` with ${with_}` : ""}`;
  };
}

export type Line = { who: string; what: string; sw: MapSwitch };

/** One line per switch and input: "Round Display 1 · page Bano" + "Tap toggles · Ring dims". */
export function lines(gs: Gesture[], fmt: (g: Gesture) => string): Line[] {
  const out: { who: string; sw: MapSwitch; parts: string[] }[] = [];
  const by = new Map<string, (typeof out)[number]>();
  for (const g of gs) {
    let entry = by.get(g.who);
    if (!entry) {
      entry = { who: g.who, sw: g.sw, parts: [] };
      by.set(g.who, entry);
      out.push(entry);
    }
    entry.parts.push(fmt(g));
  }
  return out.map((entry) => ({ who: entry.who, what: entry.parts.join(" · "), sw: entry.sw }));
}

export function staleText(g: Gesture): string {
  if (g.t.k !== "x") return "";
  return `${verbObj(g, `a ${g.t.type}`)} that isn't in this snapshot (${g.t.id.slice(0, 8)}…)`;
}

// ---- marks

export type Mark =
  /** A Round page. `via`: it reaches the light through a room or zone (drawn outlined). */
  | { kind: "chip"; label: string; title: string; sw: MapSwitch; via?: boolean }
  | { kind: "dot"; title: string; sw: MapSwitch }
  | { kind: "ring"; title: string; sw: MapSwitch };

/** One mark per switch, or per page for a Round (a chip). */
export function marks(gs: Gesture[]): Mark[] {
  const out: Mark[] = [];
  const seen = new Set<string>();
  for (const g of gs) {
    const key = g.sw.named ? `${g.sw.id}|${g.u.ctx}` : g.sw.id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (g.sw.named && g.u.title) {
      const acts = [...new Set(gs.filter((x) => x.sw === g.sw && x.u === g.u).map((x) => x.name))];
      out.push({ kind: "chip", label: g.u.title, title: `${g.sw.name} · ${g.u.sub} · ${acts.join(", ")}`, sw: g.sw });
    } else {
      const acts = [
        ...new Set(gs.filter((x) => x.sw === g.sw).map((x) => `${x.u.title || x.u.ctx} ${x.name}`)),
      ];
      out.push({ kind: "dot", title: `${g.sw.name} · ${acts.join(", ")}`, sw: g.sw });
    }
  }
  return out;
}

/**
 * Direct marks, then what reaches the light through a room or zone (not scenes): an
 * outlined chip per Round page, and a ring per other switch that isn't already direct.
 */
export function lightMarks(model: LightsModel, light: MapLight): Mark[] {
  const directIds = new Set(light.direct.map((g) => g.sw.id));
  const directUnits = new Set(light.direct.map((g) => g.u));
  const viaG = light.viaGroups.flatMap((key) => light.via[key].filter((g) => g.act !== "scenes"));
  const through = (gs: Gesture[]) =>
    [...new Set(gs.map((g) => model.gmap[(g.t as { key: string }).key].name))].join(", ");
  const pages: Mark[] = [];
  const rings: Mark[] = [];
  for (const sw of [...new Set(viaG.map((g) => g.sw))]) {
    const mine = viaG.filter((g) => g.sw === sw);
    if (sw.named) {
      for (const u of [...new Set(mine.map((g) => g.u))]) {
        if (directUnits.has(u) || !u.title) continue;
        const gs = mine.filter((g) => g.u === u);
        pages.push({ kind: "chip", via: true, label: u.title, title: `${sw.name} · ${u.sub} · through ${through(gs)}`, sw });
      }
    } else if (!directIds.has(sw.id)) {
      rings.push({ kind: "ring", title: `${sw.name} · through ${through(mine)}`, sw });
    }
  }
  return [...marks(light.direct), ...pages, ...rings];
}

// ---- details

export type DetailBlock = {
  label: string;
  lines: Line[];
  groups: { name: string; kind: string; lines: Line[] }[];
};

export type SceneChip = { name: string; used: boolean; title: string; sws: MapSwitch[] };

export type Detail = {
  blocks: DetailBlock[];
  note: string | null;
  scenes: SceneChip[];
  facts: string | null;
};

export function lightDetail(model: LightsModel, light: MapLight): Detail {
  const blocks: DetailBlock[] = [];
  if (light.direct.length) {
    blocks.push({ label: "Direct", lines: lines(light.direct, phraseSelf(model, light.id)), groups: [] });
  }
  if (light.viaGroups.length) {
    blocks.push({
      label: "Through a room or zone",
      lines: [],
      groups: light.viaGroups.map((key) => ({
        name: model.gmap[key].name,
        kind: model.gmap[key].type,
        lines: lines(light.via[key], phraseGroup),
      })),
    });
  }
  return {
    blocks,
    note:
      light.status === "none"
        ? "No switch reaches this light, directly or through its room or a zone."
        : null,
    scenes: [],
    facts: [
      light.zones.length
        ? `Zones: ${light.zones.map((key) => model.gmap[key].name).join(", ")}`
        : "In no zone",
      light.color ? "Colour" : "White",
      `${light.on ? "On" : "Off"} at snapshot time`,
    ].join(" · "),
  };
}

export function sceneChips(model: LightsModel, group: MapGroup): SceneChip[] {
  return group.scenes
    .map((name) => {
      const use = model.sceneUse[`${group.key}|${name}`];
      return {
        name,
        used: Boolean(use),
        title: use ? `In the cycle on ${[...new Set(use.map((g) => g.who))].join(", ")}` : "",
        sws: use ? [...new Set(use.map((g) => g.sw))] : [],
      };
    })
    .sort((a, b) => Number(b.used) - Number(a.used));
}

export function groupDetail(model: LightsModel, group: MapGroup): Detail {
  const ctl = model.groupCtl[group.key] ?? [];
  const blocks: DetailBlock[] = [];
  if (ctl.length) blocks.push({ label: `Whole ${group.type}`, lines: lines(ctl, phraseGroup), groups: [] });
  if (group.type === "room") {
    const viaZ = model.zones
      .filter((zone) => model.groupCtl[zone.key] && group.lights.some((id) => zone.lights.includes(id)))
      .sort((a, b) => a.lights.length - b.lights.length);
    if (viaZ.length) {
      blocks.push({
        label: "Also through zones",
        lines: [],
        groups: viaZ.map((zone) => {
          const c = group.lights.filter((id) => zone.lights.includes(id)).length;
          return {
            name: zone.name,
            kind: c < group.lights.length ? `${c} of ${group.lights.length} lights` : "all lights",
            lines: lines(model.groupCtl[zone.key], phraseGroup),
          };
        }),
      });
    }
  }
  const own = group.lights.filter((id) => model.lights[id].direct.length).map((id) => model.lights[id].name);
  return {
    blocks,
    note: ctl.length
      ? null
      : `No switch controls this ${group.type} as a whole.` +
        (own.length
          ? ` ${own.join(", ")} ${own.length === 1 ? "has a switch of its" : "have switches of their"} own.`
          : ""),
    scenes: sceneChips(model, group),
    facts: group.type === "zone" ? zoneRooms(model, group) : null,
  };
}

/** "all of Cocina · 1 of 4 in Hall Acceso", or "Every light on the Bridge". */
export function zoneRooms(model: LightsModel, zone: MapGroup): string {
  if (zone.all) return "Every light on the Bridge";
  return roomShares(model, zone)
    .map(({ room, count }) =>
      count === room.lights.length ? `all of ${room.name}` : `${count} of ${room.lights.length} in ${room.name}`,
    )
    .join(" · ");
}

export function roomShares(model: LightsModel, zone: MapGroup) {
  return model.rooms
    .map((room) => ({ room, ids: room.lights.filter((id) => zone.lights.includes(id)) }))
    .filter(({ ids }) => ids.length > 0)
    .map(({ room, ids }) => ({ room, ids, count: ids.length }));
}

export function countsText(model: LightsModel, withScenes: boolean): string {
  const n = Object.keys(model.lights).length;
  if (n === 0) return "No lights";
  return [
    plural(n, "light"),
    plural(model.rooms.length, "room"),
    plural(model.zones.length, "zone"),
    ...(withScenes ? [plural(model.nScenes, "scene")] : []),
  ].join(" · ");
}

export function snapshotText(snapshot: TopologySnapshot): string {
  const at = snapshot.receivedAt;
  const min = minutesSince(at || null);
  if (min === null) return "No snapshot yet";
  const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `Snapshot ${agoText(min)} · ${time}`;
}
