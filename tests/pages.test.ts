import { describe, expect, it } from "vitest";
import {
  computeDim,
  isScreenTimeoutSec,
  normalizePageName,
  validateRoundConfig,
} from "@/lib/pages";
import { parseRoundPages, parseScreenTimeoutSec } from "@/lib/parse";
import type { RoundRecipe, SwitchPage, TopologySnapshot } from "@/lib/types";

const snapshot: TopologySnapshot = {
  receivedAt: "2026-09-29T00:00:00.000Z",
  bridgeid: "001788FFFE123456",
  lights: [
    { id: "lamp", name: "Lamp", caps: ["dim", "ct"] },
    { id: "plug", name: "Plug", caps: ["on_off"] },
    { id: "old", name: "Old bulb" },
    { id: "hall", name: "Hall" },
  ],
  rooms: [
    {
      id: "living",
      name: "Living",
      grouped_light_id: "g-living",
      light_ids: ["lamp", "plug", "old"],
      rtype: "room",
    },
    { id: "hallway", name: "Hallway", grouped_light_id: "g-hall", light_ids: ["hall"], rtype: "room" },
    { id: "nogroup", name: "Empty", grouped_light_id: null, light_ids: [] },
  ],
  scenes: [
    { id: "relax", name: "Relax", group_rtype: "room", group_rid: "living" },
    { id: "bright", name: "Bright", group_rtype: "room", group_rid: "hallway" },
  ],
};

const livingGroup = { rtype: "room" as const, rid: "living", groupedLightRid: "g-living" };

function page(overrides: Partial<SwitchPage> = {}): SwitchPage {
  return {
    id: "p1",
    name: "Living",
    sortOrder: 0,
    theme: "ember",
    group: livingGroup,
    dim: null,
    ...overrides,
  };
}

const tapLight = (rid: string): RoundRecipe => ({
  pageId: "p1",
  event: "short",
  action: "toggle",
  target: { rtype: "light", rid },
});

describe("computeDim", () => {
  it("dims the group when a scene is recalled", () => {
    const recipes: RoundRecipe[] = [
      {
        pageId: "p1",
        event: "short",
        action: "recall_scene",
        targets: [{ rtype: "scene", rid: "relax", name: "Relax" }],
      },
    ];
    expect(computeDim(recipes, "g-living", snapshot)).toEqual({ mode: "group", rid: "g-living" });
  });

  it("dims the group when a slot targets the page's grouped_light", () => {
    const recipes: RoundRecipe[] = [
      tapLight("lamp"),
      {
        pageId: "p1",
        event: "double_click",
        action: "off",
        target: { rtype: "grouped_light", rid: "g-living" },
      },
    ];
    expect(computeDim(recipes, "g-living", snapshot)).toEqual({ mode: "group", rid: "g-living" });
  });

  it("dims only the lights the slots target, once each", () => {
    const recipes: RoundRecipe[] = [
      tapLight("lamp"),
      { ...tapLight("lamp"), event: "double_click" },
    ];
    expect(computeDim(recipes, "g-living", snapshot)).toEqual({ mode: "lights", rids: ["lamp"] });
  });

  it("leaves out a light whose caps lack dim", () => {
    const recipes: RoundRecipe[] = [tapLight("lamp"), { ...tapLight("plug"), event: "double_click" }];
    expect(computeDim(recipes, "g-living", snapshot)).toEqual({ mode: "lights", rids: ["lamp"] });
  });

  it("returns null when every targeted light lacks dim", () => {
    expect(computeDim([tapLight("plug")], "g-living", snapshot)).toBeNull();
  });

  it("keeps a light with no caps (old snapshot) or one missing from the snapshot dimmable", () => {
    expect(computeDim([tapLight("old")], "g-living", snapshot)).toEqual({
      mode: "lights",
      rids: ["old"],
    });
    expect(computeDim([tapLight("gone")], "g-living", snapshot)).toEqual({
      mode: "lights",
      rids: ["gone"],
    });
  });

  it("keeps every light dimmable without a snapshot", () => {
    expect(computeDim([tapLight("plug")], "g-living")).toEqual({ mode: "lights", rids: ["plug"] });
  });

  it("returns null with no recipes", () => {
    expect(computeDim([], "g-living", snapshot)).toBeNull();
  });
});

describe("page names", () => {
  it("folds to ASCII and cuts at 12 characters", () => {
    expect(normalizePageName("Salón")).toBe("Salon");
    expect(normalizePageName("  Living room upstairs ")).toBe("Living room");
    expect(normalizePageName("Kitchen 🍳")).toBe("Kitchen");
  });

  it("falls back to Page when nothing is left", () => {
    expect(normalizePageName("🌙")).toBe("Page");
    expect(normalizePageName("   ")).toBe("Page");
  });

  it("parseRoundPages folds names, defaults the theme and keeps order", () => {
    const pages = parseRoundPages([
      { id: "a", name: "Dormitório", group: livingGroup },
      { id: "b", name: "Hall", theme: "night", group: null },
    ]);
    expect(pages).toEqual([
      { id: "a", name: "Dormitorio", sortOrder: 0, theme: "ember", group: livingGroup, dim: null },
      { id: "b", name: "Hall", sortOrder: 1, theme: "night", group: null, dim: null },
    ]);
  });

  it("parseRoundPages rejects an unknown theme or a malformed group", () => {
    expect(parseRoundPages([{ id: "a", name: "A", theme: "neon" }])).toBeNull();
    expect(parseRoundPages([{ id: "a", name: "A", group: { rtype: "area", rid: "x" } }])).toBeNull();
  });
});

describe("screen timeout", () => {
  it("allows 0 (never) or 10–600 whole seconds", () => {
    expect(isScreenTimeoutSec(0)).toBe(true);
    expect(isScreenTimeoutSec(10)).toBe(true);
    expect(isScreenTimeoutSec(600)).toBe(true);
    expect(isScreenTimeoutSec(9)).toBe(false);
    expect(isScreenTimeoutSec(601)).toBe(false);
    expect(isScreenTimeoutSec(30.5)).toBe(false);
    expect(isScreenTimeoutSec("30")).toBe(false);
  });

  it("parseScreenTimeoutSec: undefined when omitted, null when invalid, numeric strings accepted", () => {
    expect(parseScreenTimeoutSec(undefined)).toBeUndefined();
    expect(parseScreenTimeoutSec(45)).toBe(45);
    expect(parseScreenTimeoutSec(" 60 ")).toBe(60);
    expect(parseScreenTimeoutSec("")).toBeNull();
    expect(parseScreenTimeoutSec(5)).toBeNull();
    expect(parseScreenTimeoutSec("abc")).toBeNull();
  });
});

describe("validateRoundConfig", () => {
  it("accepts a page with a group and recipes inside it", () => {
    expect(validateRoundConfig([page()], [tapLight("lamp")], snapshot)).toBeNull();
  });

  it("needs at least one page", () => {
    expect(validateRoundConfig([], [], snapshot)).toBe("a round display needs at least one page");
  });

  it("requires a group on save", () => {
    expect(validateRoundConfig([page({ group: null })], [], snapshot)).toBe(
      "page Living needs a room or zone",
    );
  });

  it("refuses a group that is not in the snapshot", () => {
    expect(
      validateRoundConfig(
        [page({ group: { rtype: "room", rid: "attic", groupedLightRid: "g-attic" } })],
        [],
        snapshot,
      ),
    ).toBe("unknown room or zone for page Living");
  });

  it("refuses duplicate page ids and names over 12 characters", () => {
    expect(validateRoundConfig([page(), page({ name: "Other" })], [], snapshot)).toBe(
      "duplicate page id p1",
    );
    expect(validateRoundConfig([page({ name: "Thirteen char" })], [], snapshot)).toBe(
      "page name must be 1–12 characters",
    );
  });

  it("refuses more than 6 pages", () => {
    const pages = Array.from({ length: 7 }, (_, i) => page({ id: `p${i}`, sortOrder: i }));
    expect(validateRoundConfig(pages, [], snapshot)).toBe("at most 6 pages");
  });

  it("refuses a recipe outside the page's room", () => {
    expect(validateRoundConfig([page()], [tapLight("hall")], snapshot)).toBe(
      "Recipes must belong to the page's room or zone.",
    );
  });

  it("refuses a scene from another room", () => {
    const recipes: RoundRecipe[] = [
      {
        pageId: "p1",
        event: "short",
        action: "recall_scene",
        targets: [{ rtype: "scene", rid: "bright", name: "Bright" }],
      },
    ];
    expect(validateRoundConfig([page()], recipes, snapshot)).toBe(
      "Scenes must belong to the page's room or zone.",
    );
  });

  it("refuses two recipes for the same page and event", () => {
    expect(validateRoundConfig([page()], [tapLight("lamp"), tapLight("old")], snapshot)).toBe(
      "duplicate recipe for p1:short",
    );
  });
});
