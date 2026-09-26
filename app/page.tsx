import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { listBridges, listSwitches } from "@/lib/db";
import { formatMac } from "@/lib/mac";
import type { TopologySnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bridges",
};

function snapshotCounts(snapshot: TopologySnapshot | null) {
  if (!snapshot) return "No snapshot";
  const lights = snapshot.lights?.length ?? 0;
  const groups = snapshot.rooms ?? [];
  const rooms = groups.filter((room) => room.rtype !== "zone").length;
  const zones = groups.length - rooms;
  const scenes = snapshot.scenes?.length ?? 0;
  return `${lights} lights · ${rooms} rooms · ${zones} zones · ${scenes} scenes`;
}

export default async function Home() {
  const user = await requireSessionUser();
  const [bridges, switches] = await Promise.all([
    listBridges(user.id),
    listSwitches(user.id),
  ]);

  if (bridges.length === 1) {
    redirect(`/bridges/${encodeURIComponent(bridges[0].bridgeid)}/switches`);
  }

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bridges</h1>
        <p className="max-w-2xl text-sm text-muted">
          Each Hue Bridge has its own rooms, lights, scenes, and switches. Open
          one to set up its switches.
        </p>
      </section>

      {bridges.length === 0 ? (
        <section className="flex flex-col gap-4 rounded-xl border border-dashed border-line bg-cream p-6">
          <h2 className="text-lg font-medium">No Bridge yet</h2>
          <ol className="flex max-w-xl list-decimal flex-col gap-2 pl-5 text-sm text-muted">
            <li>Set up a board on Setup, in Chrome or Edge.</li>
            <li>When the board asks, press the button on the Hue Bridge.</li>
            <li>
              Come back here. The Bridge&apos;s rooms, lights, and scenes appear
              once the board checks in.
            </li>
          </ol>
          <p className="flex flex-wrap gap-4">
            <Link
              href="/setup"
              className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
            >
              Go to Setup
            </Link>
          </p>
          {switches.length > 0 ? (
            <p className="text-sm text-muted">
              {switches.length} switch{switches.length === 1 ? " is" : "es are"}{" "}
              registered but no Bridge has arrived yet. Restart a board so it
              checks in again.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-3">
          {bridges.map((bridge) => {
            const snap = bridge.snapshot;
            const boards = switches.filter(
              (item) => item.bridgeid === bridge.bridgeid,
            );
            return (
              <article
                key={bridge.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-mono text-base">{bridge.bridgeid}</h2>
                    <p className="text-sm text-muted">
                      {bridge.bridge_ip ? (
                        <span className="font-mono">{bridge.bridge_ip} · </span>
                      ) : null}
                      {snapshotCounts(snap)} · {boards.length} switch
                      {boards.length === 1 ? "" : "es"} · updated{" "}
                      {new Date(bridge.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/bridges/${encodeURIComponent(bridge.bridgeid)}/switches`}
                    className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
                  >
                    Open
                  </Link>
                </div>
                {boards.length > 0 ? (
                  <p className="text-sm text-muted">
                    {boards
                      .map((item) => item.label || formatMac(item.mac))
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="text-sm text-muted">
                    Topology is here; no switch has registered against this
                    Bridge yet.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </Shell>
  );
}
