import { describe, expect, it } from "vitest";
import { isSetupKeyName, usbKeyName } from "@/lib/web-setup/products";

describe("isSetupKeyName", () => {
  const at = new Date(2026, 8, 23, 17, 48);

  it("recognizes every name Setup makes", () => {
    expect(isSetupKeyName(usbKeyName({ at }))).toBe(true);
    expect(isSetupKeyName(usbKeyName({ mac: "58e6c519bbd4", productId: "simple", at }))).toBe(true);
    expect(isSetupKeyName(usbKeyName({ productId: "round", at }))).toBe(true);
  });

  it("keeps names people typed", () => {
    expect(isSetupKeyName("Kitchen XIAO")).toBe(false);
    expect(isSetupKeyName("USB")).toBe(false);
    expect(isSetupKeyName("Dev build 2026-09-23")).toBe(false);
  });
});
