import { compareVersions } from "@/lib/web-setup/devices";

// /admin "Fleet": how many switches run each firmware version, per product. Counts only.
// It answers AGENTS.md's rule that an old path goes only once no switch reports an older firmware.

export type FleetCount = {
  firmware: string | null;
  switches: number;
  /** Not seen for 24 h, or never. */
  quiet: number;
  /** An OTA error reported in the last 7 days. */
  otaFailed: number;
};

export type FleetRow = FleetCount & {
  /** Against the product's current release; "unknown" when either is missing or unparsable. */
  relation: "current" | "older" | "newer" | "unknown";
};

/** Newest version first; unknown or missing firmware last. */
export function fleetRows(counts: FleetCount[], current: string | null): FleetRow[] {
  const rows = counts.map((count): FleetRow => {
    const cmp = count.firmware && current ? compareVersions(count.firmware, current) : null;
    const relation = cmp === 0 ? "current" : cmp === -1 ? "older" : cmp === 1 ? "newer" : "unknown";
    return { ...count, relation };
  });
  // 2: a version, 1: unparsable text, 0: nothing reported.
  const rank = (firmware: string | null) =>
    !firmware ? 0 : compareVersions(firmware, "0.0.0") === null ? 1 : 2;
  return rows.sort((a, b) => {
    const byRank = rank(b.firmware) - rank(a.firmware);
    if (byRank !== 0 || rank(a.firmware) < 2) return byRank;
    return compareVersions(b.firmware as string, a.firmware as string) ?? 0;
  });
}
