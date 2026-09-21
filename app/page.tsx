import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { listBridges, listSwitches } from "@/lib/db";
import { formatMac } from "@/lib/mac";
import type { TopologySnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

function snapshotCounts(snapshot: TopologySnapshot | null) {
  if (!snapshot) return "No snapshot";
  const lights = snapshot.lights?.length ?? 0;
  const rooms = snapshot.rooms?.length ?? 0;
  const scenes = snapshot.scenes?.length ?? 0;
  return `${lights} lights · ${rooms} rooms · ${scenes} scenes`;
}

export default async function Home() {
  const user = await requireSessionUser();
  const [bridges, switches] = await Promise.all([
    listBridges(user.id),
    listSwitches(user.id),
  ]);

  if (bridges.length === 1) {
    redirect(`/bridges/${encodeURIComponent(bridges[0].bridgeid)}`);
  }

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bridges</h1>
        <p className="max-w-2xl text-sm text-muted">
          Configuration is per Bridge — not a Hue Home. Switches paired to the
          same <span className="font-mono text-xs">bridgeid</span> share one
          topology. Open a Bridge to assign recipes per channel and event.
        </p>
      </section>

      {bridges.length === 0 ? (
        <section className="flex flex-col gap-4 rounded-xl border border-dashed border-line bg-cream p-6">
          <h2 className="text-lg font-medium">No Bridge snapshot yet</h2>
          <ol className="flex max-w-xl list-decimal flex-col gap-2 pl-5 text-sm text-muted">
            <li>
              Plug a virgin XIAO into USB and use Install device (Chrome or
              Edge). Developers can still put a key in{" "}
              <code className="font-mono text-xs">config.h</code>.
            </li>
            <li>
              Let the XIAO pair with Hue on the LAN, then register. Or run{" "}
              <code className="font-mono text-xs">npm run push-from-bridge</code>{" "}
              from a machine that can reach the Bridge.
            </li>
            <li>
              Come back here. Rooms, lights, and scenes will appear so you can
              assign on / off / double-click.
            </li>
          </ol>
          <p className="flex flex-wrap gap-4">
            <Link
              href="/install"
              className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
            >
              Install device
            </Link>
            <Link
              href="/keys"
              className="self-center text-sm font-medium text-filament hover:underline"
            >
              Manage API keys
            </Link>
          </p>
          {switches.length > 0 ? (
            <p className="text-sm text-muted">
              {switches.length} switch{switches.length === 1 ? "" : "es"}{" "}
              registered, but no topology row yet. Re-register so the snapshot
              lands.
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
                    href={`/bridges/${encodeURIComponent(bridge.bridgeid)}`}
                    className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
                  >
                    Open workspace
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
