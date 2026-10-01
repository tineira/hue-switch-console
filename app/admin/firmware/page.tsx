import { AdminFrame, CARD, FirmwareTable, NotesOnlyRow, waitingReleases } from "@/app/admin/parts";
import { fleetCounts } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { listStoredReleases } from "@/lib/firmware";
import { firmwareTable } from "@/lib/fleet";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Firmware · Admin",
};

// What /setup installs and Switches offers, and what the switches run (docs/specs/finished/admin-tabs.md §2).
export default async function AdminFirmwarePage() {
  const admin = await requireAdmin();
  const [roundReleases, simpleReleases, fleet, waiting] = await Promise.all([
    listStoredReleases("round"),
    listStoredReleases("simple"),
    fleetCounts(),
    waitingReleases(),
  ]);

  return (
    <AdminFrame email={admin.email} active="firmware">
      {waiting.length > 0 ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">
          <span className="font-medium text-warn">Waiting to go live:</span>{" "}
          {waiting.map((r) => `${r.label} ${r.version}`).join(", ")}. Nothing changes for anyone until you
          press <span className="font-medium">Make current</span> below.
        </p>
      ) : null}
      <section className={CARD}>
        <p className="text-sm text-muted">
          What <code>/setup</code> installs and Switches offers over Wi-Fi. A new upload from firmware CI
          waits here until you make it current; until then it is not installed, offered or shown on{" "}
          <code>/changelog</code>. Make an older release current to roll back. Beside each release: the
          switches that run it.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {(
            [
              ["round", "Round", roundReleases, fleet.round],
              ["simple", "Simple", simpleReleases, fleet.simple],
            ] as const
          ).map(([product, label, releases, counts]) => {
            const { rows, notesOnly } = firmwareTable(releases, counts);
            return (
              <div key={product} className="flex flex-col gap-3">
                <h2 className="text-base font-medium">{label}</h2>
                <FirmwareTable product={product} rows={rows} />
                {notesOnly.length > 0 ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted">
                      Older releases, notes only ({notesOnly.length})
                    </summary>
                    <ul className="mt-1 flex max-h-72 flex-col divide-y divide-line overflow-y-auto">
                      {notesOnly.map((r) => (
                        <NotesOnlyRow key={r.version} release={r} />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </AdminFrame>
  );
}
