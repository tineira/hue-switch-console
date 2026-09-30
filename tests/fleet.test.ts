import { describe, expect, it } from "vitest";
import { fleetRows, type FleetCount } from "@/lib/fleet";

const count = (firmware: string | null, switches = 1): FleetCount => ({
  firmware,
  switches,
  quiet: 0,
  otaFailed: 0,
});

describe("fleetRows", () => {
  it("sorts newest first and marks each against the current release", () => {
    const rows = fleetRows([count("0.6.4"), count("0.10.0"), count("0.7.1", 3)], "0.7.1");
    expect(rows.map((r) => [r.firmware, r.relation])).toEqual([
      ["0.10.0", "newer"],
      ["0.7.1", "current"],
      ["0.6.4", "older"],
    ]);
  });

  it("puts unparsable and missing firmware last", () => {
    const rows = fleetRows([count(null), count("dev"), count("0.5.0")], "0.5.0");
    expect(rows.map((r) => [r.firmware, r.relation])).toEqual([
      ["0.5.0", "current"],
      ["dev", "unknown"],
      [null, "unknown"],
    ]);
  });

  it("marks everything unknown without a current release", () => {
    expect(fleetRows([count("0.1.0")], null)[0].relation).toBe("unknown");
  });
});
