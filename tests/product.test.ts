import { describe, expect, it } from "vitest";
import { decideSwitchProduct, inferProduct, isPlaceholderRoundChannels } from "@/lib/pages";
import type { Channel } from "@/lib/types";

const simpleChannels: Channel[] = [
  { id: "boot", gpio: 9, label: "BOOT" },
  { id: "d0", gpio: 0, label: "D0" },
];
const placeholderC1: Channel[] = [{ id: "c1", gpio: 0, label: "C1" }];

describe("inferProduct", () => {
  it("uses an explicit product", () => {
    expect(inferProduct("simple", [])).toBe("simple");
    expect(inferProduct("round", simpleChannels)).toBe("round");
  });

  it("infers round from no channels or a lone c1", () => {
    expect(inferProduct(undefined, [])).toBe("round");
    expect(inferProduct(undefined, placeholderC1)).toBe("round");
    expect(isPlaceholderRoundChannels(placeholderC1)).toBe(true);
  });

  it("infers simple from GPIO channels", () => {
    expect(inferProduct(undefined, simpleChannels)).toBe("simple");
    expect(inferProduct(undefined, [{ id: "d0", gpio: 0, label: "D0" }])).toBe("simple");
  });
});

describe("decideSwitchProduct (upsertSwitch)", () => {
  it("a new switch takes the explicit product", () => {
    expect(
      decideSwitchProduct({ requested: "round", channels: [], existing: null }),
    ).toEqual({ product: "round", wipeToSimple: false });
    expect(
      decideSwitchProduct({ requested: "simple", channels: simpleChannels, existing: null }),
    ).toEqual({ product: "simple", wipeToSimple: false });
  });

  it("a new switch without product is inferred", () => {
    expect(decideSwitchProduct({ requested: undefined, channels: [], existing: null })).toEqual({
      product: "round",
      wipeToSimple: false,
    });
    expect(
      decideSwitchProduct({ requested: undefined, channels: simpleChannels, existing: null }),
    ).toEqual({ product: "simple", wipeToSimple: false });
  });

  it("a stored Round stays Round when product is omitted, even with GPIO channels", () => {
    expect(
      decideSwitchProduct({
        requested: undefined,
        channels: simpleChannels,
        existing: { product: "round" },
      }),
    ).toEqual({ product: "round", wipeToSimple: false });
  });

  it("only an explicit simple wipes a stored Round", () => {
    expect(
      decideSwitchProduct({
        requested: "simple",
        channels: simpleChannels,
        existing: { product: "round" },
      }),
    ).toEqual({ product: "simple", wipeToSimple: true });
  });

  it("a stored Simple becomes Round when the board says round, with no wipe", () => {
    expect(
      decideSwitchProduct({ requested: "round", channels: [], existing: { product: "simple" } }),
    ).toEqual({ product: "round", wipeToSimple: false });
  });

  it("a stored Simple with no product and no channels is inferred as Round", () => {
    expect(
      decideSwitchProduct({ requested: undefined, channels: [], existing: { product: "simple" } }),
    ).toEqual({ product: "round", wipeToSimple: false });
  });
});
