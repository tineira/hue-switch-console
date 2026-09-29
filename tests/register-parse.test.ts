import { describe, expect, it } from "vitest";
import {
  asString,
  parseChannels,
  parseLights,
  parseMac,
  parseProduct,
  parseRooms,
  parseScenes,
} from "@/lib/parse";

// The pieces POST /api/device/register uses to read its body (docs/device-api.md).

describe("parseLights", () => {
  it("reads id, name, on and caps", () => {
    expect(
      parseLights([{ id: "l1", name: "Lamp", on: true, caps: ["dim", 3, "ct"] }]),
    ).toEqual([{ id: "l1", name: "Lamp", on: true, caps: ["dim", "ct"] }]);
  });

  it("leaves caps undefined when the board sends none (old snapshots stay dimmable)", () => {
    expect(parseLights([{ id: "l1", name: "Lamp" }])).toEqual([
      { id: "l1", name: "Lamp", on: undefined, caps: undefined },
    ]);
  });

  it("accepts an empty array", () => {
    expect(parseLights([])).toEqual([]);
  });

  it("rejects a missing array or an item without id or name", () => {
    expect(parseLights(undefined)).toBeNull();
    expect(parseLights({})).toBeNull();
    expect(parseLights([{ id: "l1" }])).toBeNull();
    expect(parseLights([{ id: "  ", name: "Lamp" }])).toBeNull();
    expect(parseLights([null])).toBeNull();
  });
});

describe("parseRooms", () => {
  it("reads rooms and zones", () => {
    expect(
      parseRooms([
        { id: "r1", name: "Living", grouped_light_id: "g1", light_ids: ["l1", 2], rtype: "zone" },
      ]),
    ).toEqual([
      { id: "r1", name: "Living", grouped_light_id: "g1", light_ids: ["l1"], rtype: "zone" },
    ]);
  });

  it("defaults grouped_light_id to null, light_ids to [] and drops an unknown rtype", () => {
    expect(parseRooms([{ id: "r1", name: "Living", rtype: "area" }])).toEqual([
      { id: "r1", name: "Living", grouped_light_id: null, light_ids: [], rtype: undefined },
    ]);
  });

  it("rejects a non-array or a room without a name", () => {
    expect(parseRooms("rooms")).toBeNull();
    expect(parseRooms([{ id: "r1" }])).toBeNull();
  });
});

describe("parseScenes", () => {
  it("reads scenes and defaults the group to empty strings", () => {
    expect(
      parseScenes([
        { id: "s1", name: "Relax", group_rtype: "room", group_rid: "r1" },
        { id: "s2", name: "Read" },
      ]),
    ).toEqual([
      { id: "s1", name: "Relax", group_rtype: "room", group_rid: "r1" },
      { id: "s2", name: "Read", group_rtype: "", group_rid: "" },
    ]);
  });

  it("rejects a non-array", () => {
    expect(parseScenes(null)).toBeNull();
  });
});

describe("parseChannels", () => {
  it("treats an omitted field as no channels (push-from-bridge)", () => {
    expect(parseChannels(undefined)).toEqual([]);
  });

  it("reads Simple GPIO channels and falls back to the id as label", () => {
    expect(
      parseChannels([
        { id: "boot", gpio: 9, label: "BOOT" },
        { id: "d0", gpio: 0 },
      ]),
    ).toEqual([
      { id: "boot", gpio: 9, label: "BOOT" },
      { id: "d0", gpio: 0, label: "d0" },
    ]);
  });

  it("accepts the kind old Simple firmware sends, and drops it", () => {
    expect(parseChannels([{ id: "d0", gpio: 0, kind: "momentary" }])).toEqual([
      { id: "d0", gpio: 0, label: "d0" },
    ]);
  });

  it("rejects an unknown kind, a bad gpio or a non-array", () => {
    expect(parseChannels([{ id: "d0", gpio: 0, kind: "latching" }])).toBeNull();
    expect(parseChannels([{ id: "d0", gpio: -1 }])).toBeNull();
    expect(parseChannels([{ id: "d0", gpio: 1.5 }])).toBeNull();
    expect(parseChannels([{ id: "d0", gpio: "0" }])).toBeNull();
    expect(parseChannels("d0")).toBeNull();
  });
});

describe("parseMac", () => {
  it("normalizes separators and case", () => {
    expect(parseMac("AA:BB:CC:DD:EE:FF")).toBe("aabbccddeeff");
    expect(parseMac("aa-bb-cc-dd-ee-ff")).toBe("aabbccddeeff");
  });

  it("returns undefined when omitted and null when malformed", () => {
    expect(parseMac(undefined)).toBeUndefined();
    expect(parseMac("")).toBeUndefined();
    expect(parseMac("aabbcc")).toBeNull();
    expect(parseMac(1234)).toBeNull();
  });
});

describe("parseProduct", () => {
  it("accepts only round and simple", () => {
    expect(parseProduct("round")).toBe("round");
    expect(parseProduct("simple")).toBe("simple");
    expect(parseProduct("Round")).toBeUndefined();
    expect(parseProduct(undefined)).toBeUndefined();
  });
});

describe("asString", () => {
  it("trims and treats blank as missing", () => {
    expect(asString("  0.6.3 ")).toBe("0.6.3");
    expect(asString("   ")).toBeUndefined();
    expect(asString(3)).toBeUndefined();
  });
});
