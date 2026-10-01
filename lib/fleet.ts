import type { StoredRelease } from "@/lib/firmware";
import { compareVersions } from "@/lib/web-setup/devices";

// /admin "Firmware": how many switches run each firmware version, per product, beside the release
// list. It answers AGENTS.md's rule that an old path goes only once no switch reports an older firmware.

export type FleetCount = {
  firmware: string | null;
  switches: number;
  /** Not seen for 24 h, or never. */
  quiet: number;
  /** An OTA error reported in the last 7 days. */
  otaFailed: number;
};

export type Relation = "current" | "older" | "newer" | "unknown";

/** One version: an uploaded release, what switches run, or both. */
export type FirmwareRow = {
  /** null: switches that report no firmware. */
  version: string | null;
  /** null: switches run a version that was never uploaded. */
  release: StoredRelease | null;
  /** null: no switch runs it. */
  count: FleetCount | null;
  /** Against the product's current release; "unknown" when either is missing or unparsable. */
  relation: Relation;
};

function relationTo(version: string | null, current: string | null): Relation {
  const cmp = version && current ? compareVersions(version, current) : null;
  return cmp === 0 ? "current" : cmp === -1 ? "older" : cmp === 1 ? "newer" : "unknown";
}

// 2: a version, 1: unparsable text, 0: nothing reported.
const rank = (version: string | null) => (!version ? 0 : compareVersions(version, "0.0.0") === null ? 1 : 2);

/** Newest version first; unknown or missing firmware last. */
function byVersion(a: string | null, b: string | null): number {
  const byRank = rank(b) - rank(a);
  if (byRank !== 0 || rank(a) < 2) return byRank;
  return compareVersions(b as string, a as string) ?? 0;
}

/**
 * One table per product: every installable release and every version a switch runs. Notes-only
 * releases no switch runs go to `notesOnly`, behind a fold.
 */
export function firmwareTable(
  releases: StoredRelease[],
  counts: FleetCount[],
): { rows: FirmwareRow[]; notesOnly: StoredRelease[] } {
  const current = releases.find((r) => r.current)?.version ?? null;
  const byFirmware = new Map(counts.map((c) => [c.firmware, c]));
  const rows: FirmwareRow[] = [];
  const notesOnly: StoredRelease[] = [];
  for (const release of releases) {
    const count = byFirmware.get(release.version) ?? null;
    byFirmware.delete(release.version);
    if (!release.hasBins && !release.current && !count) notesOnly.push(release);
    else rows.push({ version: release.version, release, count, relation: relationTo(release.version, current) });
  }
  for (const count of byFirmware.values()) {
    rows.push({ version: count.firmware, release: null, count, relation: relationTo(count.firmware, current) });
  }
  rows.sort((a, b) => byVersion(a.version, b.version));
  return { rows, notesOnly };
}
