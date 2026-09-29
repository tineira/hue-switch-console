import { describe, expect, it } from "vitest";
import { loginHref, safeReturnPath } from "@/lib/return-path";

describe("safeReturnPath", () => {
  it("keeps a same-site path with its query and hash", () => {
    expect(safeReturnPath("/setup")).toBe("/setup");
    expect(safeReturnPath("/switches/58e6c519adc0")).toBe("/switches/58e6c519adc0");
    expect(safeReturnPath("/how-to?product=simple#status")).toBe("/how-to?product=simple#status");
  });

  it("falls back to / for nothing", () => {
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
  });

  it("refuses other origins, however they are spelled", () => {
    for (const raw of [
      "https://evil.example/setup",
      "http:/evil.example",
      "//evil.example/setup",
      "/\\evil.example",
      "\\\\evil.example",
      "/setup\\..\\..\\evil",
      "javascript:alert(1)",
      "setup",
      "/\tevil",
      "/\n/evil.example",
    ]) {
      expect(safeReturnPath(raw), raw).toBe("/");
    }
  });

  it("does not return to sign-in or to an API route", () => {
    expect(safeReturnPath("/login")).toBe("/");
    expect(safeReturnPath("/login?next=/setup")).toBe("/");
    expect(safeReturnPath("/api/keys")).toBe("/");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeReturnPath("/../setup")).toBe("/setup");
    expect(safeReturnPath("/a/../../login")).toBe("/");
  });

  it("refuses very long values", () => {
    expect(safeReturnPath(`/${"a".repeat(600)}`)).toBe("/");
  });
});

describe("loginHref", () => {
  it("carries a return path, encoded", () => {
    expect(loginHref("/setup")).toBe("/login?next=%2Fsetup");
    expect(loginHref("/how-to?product=simple")).toBe("/login?next=%2Fhow-to%3Fproduct%3Dsimple");
  });

  it("is plain /login for the home page or anything refused", () => {
    expect(loginHref("/")).toBe("/login");
    expect(loginHref("//evil.example")).toBe("/login");
    expect(loginHref(null)).toBe("/login");
  });
});
