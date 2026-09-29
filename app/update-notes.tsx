"use client";

import { ChangelogItemText } from "@/app/changelog-item";
import type { VersionNotes } from "@/lib/firmware-notes";

// What an update changes, shared by Setup and Switches (docs/specs/finished/setup-update-notes.md).

// Versions listed in full before they fold into "All changes" (docs/specs/finished/setup-update-notes.md §4.3).
const OPEN_VERSIONS = 3;

function VersionList({ notes }: { notes: VersionNotes[] }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.map((release) => (
        <div key={release.version}>
          <h4 className="text-sm font-medium">
            <span className="font-mono">{release.version}</span>
            <span className="ml-2 font-normal text-muted">{release.date}</span>
          </h4>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {release.items.map((item) => (
              <li key={item.text}>
                <ChangelogItemText item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function UpdateNotes({
  installed,
  latest,
  notes,
}: {
  installed: string;
  latest: string;
  notes: VersionNotes[];
}) {
  const important = notes.flatMap((release) =>
    release.items
      .filter((item) => item.important)
      .map((item) => ({ version: release.version, item })),
  );
  return (
    <div id="update-notes" className="flex scroll-mt-8 flex-col gap-3 px-2 py-2">
      <h3 className="text-sm font-medium">
        What changes from <span className="font-mono">{installed}</span> to{" "}
        <span className="font-mono">{latest}</span>
      </h3>
      {important.length > 0 ? (
        <ul className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
          {important.map(({ version, item }) => (
            <li key={`${version}-${item.text}`}>
              <ChangelogItemText item={item} />{" "}
              <span className="font-mono text-xs text-muted">({version})</span>
            </li>
          ))}
        </ul>
      ) : null}
      {notes.length <= OPEN_VERSIONS ? (
        <VersionList notes={notes} />
      ) : (
        <details>
          <summary className="cursor-pointer text-sm text-filament">
            All changes in {notes.length} versions
          </summary>
          <div className="mt-2">
            <VersionList notes={notes} />
          </div>
        </details>
      )}
    </div>
  );
}
