import { notesToItems, type ChangelogItem } from "@/lib/changelog-parse";
import type { FirmwareNotes } from "@/lib/firmware";
import { compareVersions } from "@/lib/web-setup/devices";

// What an update changes, for /setup (docs/specs/setup-update-notes.md).

export type VersionNotes = { version: string; date: string; items: ChangelogItem[] };

/** Notes of every version after `installed` up to and including `latest`, newest first. */
export function notesBetween(
  releases: FirmwareNotes[],
  installed: string,
  latest: string,
): VersionNotes[] {
  if (compareVersions(installed, latest) !== -1) return [];
  return releases
    .filter((release) => {
      const upToLatest = compareVersions(release.version, latest);
      return compareVersions(installed, release.version) === -1 && (upToLatest === -1 || upToLatest === 0);
    })
    .sort((a, b) => compareVersions(b.version, a.version) ?? 0)
    .map((release) => ({
      version: release.version,
      date: release.date,
      items: notesToItems(release.notes),
    }))
    .filter((release) => release.items.length > 0);
}
