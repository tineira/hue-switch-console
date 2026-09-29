import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkPart, parseArgs, planImport, PARTS } from "@/scripts/import-firmware.mjs";

describe("parseArgs", () => {
  it("defaults to the hosted console and the current version", () => {
    expect(parseArgs(["round"])).toEqual({ product: "round", from: "https://hue.tineira.com", version: null });
  });

  it("reads --from and --version", () => {
    expect(parseArgs(["simple", "--from", "http://192.168.1.20:3000/", "--version", "0.7.1"])).toEqual({
      product: "simple",
      from: "http://192.168.1.20:3000",
      version: "0.7.1",
    });
  });

  it("rejects bad input", () => {
    expect(parseArgs([])).toHaveProperty("error");
    expect(parseArgs(["dimmer"])).toHaveProperty("error");
    expect(parseArgs(["round", "--version"])).toHaveProperty("error");
    expect(parseArgs(["round", "--version", "1.2"])).toHaveProperty("error");
    expect(parseArgs(["round", "--from", "ftp://x"])).toHaveProperty("error");
    expect(parseArgs(["round", "--force"])).toHaveProperty("error");
  });
});

const manifest = (version: string, paths = PARTS.map((name: string) => `${version}/${name}`)) => ({
  version,
  builds: [{ chipFamily: "ESP32-S3", parts: paths.map((path: string, i: number) => ({ path, offset: i })) }],
});

describe("planImport", () => {
  const from = "https://hue.tineira.com";

  it("takes the manifest's version and lists every part under it", () => {
    const plan = planImport({ from, product: "round", version: null, manifest: manifest("0.6.4") });
    expect(plan.version).toBe("0.6.4");
    expect(plan.notesUrl).toBe("https://hue.tineira.com/firmware/round/0.6.4/notes");
    expect(plan.parts).toHaveLength(4);
    expect(plan.parts?.[3]).toEqual({
      name: "firmware.bin",
      url: "https://hue.tineira.com/firmware/round/0.6.4/firmware.bin",
    });
  });

  it("refuses a manifest whose parts belong to another version", () => {
    const wrong = manifest("0.6.4", PARTS.map((name: string) => `0.6.3/${name}`));
    expect(planImport({ from, product: "round", version: null, manifest: wrong })).toHaveProperty("error");
    expect(planImport({ from, product: "round", version: null, manifest: { builds: [] } })).toHaveProperty("error");
  });

  it("uses --version without a manifest", () => {
    const plan = planImport({ from, product: "simple", version: "0.7.0", manifest: null });
    expect(plan.version).toBe("0.7.0");
    expect(plan.parts?.[0].url).toBe("https://hue.tineira.com/firmware/simple/0.7.0/bootloader.bin");
  });
});

describe("checkPart", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const sha = createHash("sha256").update(bytes).digest("hex");

  it("accepts a part that matches its ETag", () => {
    expect(checkPart("firmware.bin", bytes, `"${sha}"`)).toBeNull();
    expect(checkPart("firmware.bin", bytes, null)).toBeNull();
  });

  it("rejects an empty or altered part", () => {
    expect(checkPart("firmware.bin", new Uint8Array(), null)).toMatch(/empty/);
    expect(checkPart("firmware.bin", bytes, `"${"0".repeat(64)}"`)).toMatch(/checksum/);
  });
});
