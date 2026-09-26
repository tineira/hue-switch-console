import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { loadBridge, loadBridgeSwitches } from "@/lib/bridge-switches";
import { getSwitchByMac } from "@/lib/db";
import { formatMac, normalizeMac } from "@/lib/mac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/bridges/[bridgeid]/switches/[mac]">) {
  const { mac: raw } = await params;
  const mac = normalizeMac(raw);
  const user = mac ? await getSessionUser().catch(() => null) : null;
  const item = user && mac ? await getSwitchByMac(user.id, mac).catch(() => null) : null;
  return { title: item?.label?.trim() || (mac ? formatMac(mac) : "Switch") };
}

// The editor itself is rendered by the switches layout (see `../layout.tsx`). This page
// only canonicalises the MAC, follows a switch to its Bridge, or says it is not here.
export default async function SwitchPage({
  params,
}: PageProps<"/bridges/[bridgeid]/switches/[mac]">) {
  const user = await requireSessionUser();
  const { bridgeid, mac: raw } = await params;
  const bridge = await loadBridge(user.id, bridgeid);
  if (!bridge) return null; // The Bridge layout shows "Bridge not found".
  const overview = `/bridges/${encodeURIComponent(bridge.bridgeid)}/switches`;

  const mac = normalizeMac(raw);
  if (mac && mac !== raw) redirect(`${overview}/${mac}`);

  const switches = await loadBridgeSwitches(user.id, bridge);
  if (mac && switches.some((item) => item.mac === mac)) return null;

  const elsewhere = mac ? await getSwitchByMac(user.id, mac) : null;
  if (elsewhere && elsewhere.bridgeid !== bridge.bridgeid) {
    redirect(`/bridges/${encodeURIComponent(elsewhere.bridgeid)}/switches/${mac}`);
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-cream p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Switch not found on this Bridge</h1>
      <p className="max-w-xl text-sm text-muted">
        <span className="font-mono text-foreground">{mac ? formatMac(mac) : raw}</span> has
        not registered against this Bridge.
      </p>
      <Link href={overview} className="text-sm font-medium text-filament hover:underline">
        Back to switches
      </Link>
    </section>
  );
}
