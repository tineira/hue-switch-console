import { describe, expect, it } from "vitest";
import { isRoundSwitch } from "@/lib/db";
import { decideSwitchProduct } from "@/lib/pages";

describe("decideSwitchProduct (upsertSwitch)", () => {
  it("a new switch takes the product it sends", () => {
    expect(decideSwitchProduct({ requested: "round", existing: null })).toEqual({
      product: "round",
      wipeToSimple: false,
    });
    expect(decideSwitchProduct({ requested: "simple", existing: undefined })).toEqual({
      product: "simple",
      wipeToSimple: false,
    });
  });

  it("a stored Round that keeps saying round is not wiped", () => {
    expect(
      decideSwitchProduct({ requested: "round", existing: { product: "round" } }),
    ).toEqual({ product: "round", wipeToSimple: false });
  });

  it("only an explicit simple wipes a stored Round", () => {
    expect(
      decideSwitchProduct({ requested: "simple", existing: { product: "round" } }),
    ).toEqual({ product: "simple", wipeToSimple: true });
  });

  it("a stored Simple becomes Round when the board says round, with no wipe", () => {
    expect(
      decideSwitchProduct({ requested: "round", existing: { product: "simple" } }),
    ).toEqual({ product: "round", wipeToSimple: false });
  });
});

describe("isRoundSwitch", () => {
  it("follows the stored product only", () => {
    expect(isRoundSwitch({ product: "round" })).toBe(true);
    expect(isRoundSwitch({ product: "simple" })).toBe(false);
  });
});
