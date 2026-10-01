import { describe, expect, it } from "vitest";
import { simpleChannelGestures } from "@/lib/gestures";
import { parseSimpleChannels } from "@/lib/parse";
import {
  browserSimpleChannel,
  defaultSimpleChannel,
  deriveSimpleRecipes,
  deviceSimpleChannel,
  simpleChannelsEqual,
  validateSimpleChannels,
  withGroup,
  withKind,
} from "@/lib/simple-channels";
import type { Channel, PageGroup, TopologySnapshot } from "@/lib/types";

// docs/specs/toggle-on-flip.md

const snapshot: TopologySnapshot = {
  receivedAt: "2026-09-30T00:00:00.000Z",
  bridgeid: "001788FFFE123456",
  lights: [{ id: "lamp", name: "Lamp" }],
  rooms: [
    { id: "living", name: "Living", grouped_light_id: "g-living", light_ids: ["lamp"], rtype: "room" },
    { id: "hall", name: "Hall", grouped_light_id: "g-hall", light_ids: [], rtype: "room" },
  ],
  scenes: [],
};

const living: PageGroup = { rtype: "room", rid: "living", groupedLightRid: "g-living" };
const hall: PageGroup = { rtype: "room", rid: "hall", groupedLightRid: "g-hall" };
const registered: Channel[] = [
  { id: "boot", gpio: 9, label: "BOOT" },
  { id: "d0", gpio: 0, label: "D0" },
];

describe("flip defaults", () => {
  it("starts a new wall switch on toggle and a push button on set", () => {
    expect(defaultSimpleChannel("d0", living).flip).toBe("toggle");
    expect(defaultSimpleChannel("d0", living, "momentary").flip).toBe("set");
    expect(defaultSimpleChannel("boot", living).flip).toBe("set");
  });

  it("switching to a wall switch toggles; to a push button sets", () => {
    const button = defaultSimpleChannel("d0", living, "momentary");
    expect(withKind(button, "maintained").flip).toBe("toggle");
    const lever = { ...defaultSimpleChannel("d0", living), flip: "set" as const };
    expect(withKind(lever, "momentary").flip).toBe("set");
  });

  it("keeps the flip when the group changes", () => {
    const lever = { ...defaultSimpleChannel("d0", living), flip: "set" as const };
    expect(withGroup(lever, hall).flip).toBe("set");
  });
});

describe("recipes and config poll", () => {
  it("maps on and off to toggle in toggle mode", () => {
    const recipes = deriveSimpleRecipes([defaultSimpleChannel("d0", living)]);
    expect(recipes.map((recipe) => [recipe.event, recipe.action])).toEqual([
      ["on", "toggle"],
      ["off", "toggle"],
    ]);
  });

  it("keeps on and off in set mode", () => {
    const recipes = deriveSimpleRecipes([{ ...defaultSimpleChannel("d0", living), flip: "set" }]);
    expect(recipes.map((recipe) => [recipe.event, recipe.action])).toEqual([
      ["on", "on"],
      ["off", "off"],
    ]);
  });

  it("sends flip only in toggle mode", () => {
    const toggle = deviceSimpleChannel(defaultSimpleChannel("d0", living));
    expect(Object.keys(toggle)).toEqual(["id", "kind", "flip", "group"]);
    expect(toggle).toMatchObject({ flip: "toggle" });
    const set = deviceSimpleChannel({ ...defaultSimpleChannel("d0", living), flip: "set" });
    expect(Object.keys(set)).toEqual(["id", "kind", "group"]);
  });

  it("leaves flip out of a push button in the browser API", () => {
    expect("flip" in browserSimpleChannel(defaultSimpleChannel("boot", living))).toBe(false);
    expect(browserSimpleChannel(defaultSimpleChannel("d0", living)).flip).toBe("toggle");
  });
});

describe("parse and validate", () => {
  const body = (extra: Record<string, unknown>) => [
    {
      id: "d0",
      kind: "maintained",
      group: { rtype: "room", rid: "living" },
      target: { rtype: "grouped_light", rid: "g-living" },
      scenes: [],
      double: null,
      hold: null,
      ...extra,
    },
  ];

  it("parses flip, and leaves it undefined when missing", () => {
    expect(parseSimpleChannels(body({ flip: "toggle" }))?.[0].flip).toBe("toggle");
    expect(parseSimpleChannels(body({}))?.[0].flip).toBeUndefined();
    expect(parseSimpleChannels(body({ flip: "sometimes" }))).toBeNull();
  });

  it("refuses toggle on a push button", () => {
    const button = { ...defaultSimpleChannel("d0", living, "momentary"), flip: "toggle" as const };
    expect(validateSimpleChannels([button], registered, snapshot)?.error).toBe(
      "channel_kind_not_allowed",
    );
    expect(validateSimpleChannels([defaultSimpleChannel("d0", living)], registered, snapshot)).toBeNull();
  });

  it("counts a flip change as unsaved", () => {
    const lever = defaultSimpleChannel("d0", living);
    expect(simpleChannelsEqual([lever], [{ ...lever, flip: "set" }])).toBe(false);
  });
});

describe("labels", () => {
  it("reads Toggles in toggle mode", () => {
    const [flip] = simpleChannelGestures(defaultSimpleChannel("d0", living), snapshot);
    expect(flip.label).toBe("Flip");
    expect(flip.summary).toBe("Toggles all of Living");
  });
});
