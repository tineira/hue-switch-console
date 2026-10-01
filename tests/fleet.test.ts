import { describe, expect, it } from "vitest";
import type { StoredRelease } from "@/lib/firmware";
import { firmwareTable, type FleetCount } from "@/lib/fleet";

const count = (firmware: string | null, switches = 1): FleetCount => ({
  firmware,
  switches,
  quiet: 0,
  otaFailed: 0,
});

const release = (version: string, flags: Partial<StoredRelease> = {}): StoredRelease => ({
  version,
  createdAt: "2026-09-29T00:00:00Z",
  hasBins: true,
  current: false,
  waiting: false,
  ...flags,
});

const summary = (rows: ReturnType<typeof firmwareTable>["rows"]) =>
  rows.map((r) => [r.version, r.relation, r.count?.switches ?? 0, r.release ? "release" : "fleet"]);

describe("firmwareTable", () => {
  it("puts each switch count on its release and marks it against the current one", () => {
    const { rows } = firmwareTable(
      [release("0.6.5", { waiting: true }), release("0.6.4", { current: true }), release("0.6.3")],
      [count("0.6.4", 3), count("0.6.3")],
    );
    expect(summary(rows)).toEqual([
      ["0.6.5", "newer", 0, "release"],
      ["0.6.4", "current", 3, "release"],
      ["0.6.3", "older", 1, "release"],
    ]);
  });

  it("adds versions that were never uploaded, sorted in, with unparsable and missing last", () => {
    const { rows } = firmwareTable(
      [release("0.10.0", { current: true }), release("0.7.1")],
      [count(null), count("dev"), count("0.8.0"), count("0.10.0")],
    );
    expect(summary(rows)).toEqual([
      ["0.10.0", "current", 1, "release"],
      ["0.8.0", "older", 1, "fleet"],
      ["0.7.1", "older", 0, "release"],
      ["dev", "unknown", 1, "fleet"],
      [null, "unknown", 1, "fleet"],
    ]);
  });

  it("folds notes-only releases away unless a switch still runs one", () => {
    const { rows, notesOnly } = firmwareTable(
      [release("0.6.0", { current: true }), release("0.5.0", { hasBins: false }), release("0.4.0", { hasBins: false })],
      [count("0.4.0", 2)],
    );
    expect(summary(rows)).toEqual([
      ["0.6.0", "current", 0, "release"],
      ["0.4.0", "older", 2, "release"],
    ]);
    expect(notesOnly.map((r) => r.version)).toEqual(["0.5.0"]);
  });

  it("marks everything unknown without a current release", () => {
    expect(firmwareTable([release("0.1.0")], [count("0.1.0")]).rows[0].relation).toBe("unknown");
  });
});
