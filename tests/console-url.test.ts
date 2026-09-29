import { describe, expect, it } from "vitest";
import {
  consoleHost,
  consoleMove,
  isLoopbackConsole,
  moveConfirmText,
  normalizeOrigin,
  resolveDeviceConsoleUrl,
} from "@/lib/console-url";

describe("normalizeOrigin", () => {
  it("keeps the origin of http and https URLs", () => {
    expect(normalizeOrigin("https://hue.tineira.com")).toBe("https://hue.tineira.com");
    expect(normalizeOrigin(" https://hue.example.org/ \n")).toBe("https://hue.example.org");
    expect(normalizeOrigin("http://192.168.1.20:3000/setup")).toBe("http://192.168.1.20:3000");
    expect(normalizeOrigin("HTTPS://Hue.Example.org:443")).toBe("https://hue.example.org");
  });

  it("rejects empty values, other schemes and non-URLs", () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("   ")).toBeNull();
    expect(normalizeOrigin("hue.example.org")).toBeNull();
    expect(normalizeOrigin("ftp://hue.example.org")).toBeNull();
  });
});

describe("resolveDeviceConsoleUrl", () => {
  it("prefers DEVICE_CONSOLE_URL", () => {
    expect(
      resolveDeviceConsoleUrl({
        deviceConsoleUrl: "http://192.168.1.20:3000",
        publicUrl: "https://hue.example.org",
        pageOrigin: "http://localhost:3000",
      }),
    ).toBe("http://192.168.1.20:3000");
  });

  it("falls back to the public URL, then the page origin", () => {
    expect(
      resolveDeviceConsoleUrl({ publicUrl: "https://hue.example.org/", pageOrigin: "http://localhost:3000" }),
    ).toBe("https://hue.example.org");
    expect(
      resolveDeviceConsoleUrl({ deviceConsoleUrl: "not a url", pageOrigin: "http://localhost:3000" }),
    ).toBe("http://localhost:3000");
    expect(resolveDeviceConsoleUrl({})).toBeNull();
  });

  it("gives the hosted URL on production with or without DEVICE_CONSOLE_URL", () => {
    const hosted = "https://hue.tineira.com";
    expect(resolveDeviceConsoleUrl({ deviceConsoleUrl: hosted, publicUrl: hosted, pageOrigin: hosted })).toBe(hosted);
    expect(resolveDeviceConsoleUrl({ publicUrl: hosted, pageOrigin: "https://preview.vercel.app" })).toBe(hosted);
  });
});

describe("consoleHost", () => {
  it("returns the host with a non-default port", () => {
    expect(consoleHost("https://hue.tineira.com")).toBe("hue.tineira.com");
    expect(consoleHost("http://192.168.1.20:3000")).toBe("192.168.1.20:3000");
    expect(consoleHost("junk")).toBeNull();
  });
});

describe("isLoopbackConsole", () => {
  it("flags addresses a board cannot reach", () => {
    expect(isLoopbackConsole("http://localhost:3000")).toBe(true);
    expect(isLoopbackConsole("http://127.0.0.1:3000")).toBe(true);
    expect(isLoopbackConsole("http://[::1]:3000")).toBe(true);
    expect(isLoopbackConsole("http://hue.localhost")).toBe(true);
    expect(isLoopbackConsole("http://192.168.1.20:3000")).toBe(false);
    expect(isLoopbackConsole("https://hue.tineira.com")).toBe(false);
    expect(isLoopbackConsole(null)).toBe(false);
  });
});

describe("consoleMove", () => {
  const here = "https://hue.example.org";

  it("does not ask when the board has no URL", () => {
    expect(consoleMove("", here)).toEqual({ kind: "unset" });
    expect(consoleMove(undefined, here)).toEqual({ kind: "unset" });
  });

  it("does not ask when the host is the same", () => {
    expect(consoleMove("https://hue.example.org/", here)).toEqual({ kind: "same" });
    expect(consoleMove("https://HUE.example.org", here)).toEqual({ kind: "same" });
    expect(consoleMove("http://hue.example.org", here)).toEqual({ kind: "same" });
  });

  it("asks when the host differs", () => {
    expect(consoleMove("https://hue.tineira.com", here)).toEqual({ kind: "move", from: "hue.tineira.com" });
    expect(consoleMove("http://192.168.1.20:3000", "http://192.168.1.20:3001")).toEqual({
      kind: "move",
      from: "192.168.1.20:3000",
    });
  });

  it("asks when the stored value is not a URL", () => {
    expect(consoleMove("garbage", here)).toEqual({ kind: "move", from: "garbage" });
  });

  it("names both hosts in the question", () => {
    expect(moveConfirmText("hue.tineira.com", here)).toContain("set up for hue.tineira.com. Move it to hue.example.org?");
  });
});
