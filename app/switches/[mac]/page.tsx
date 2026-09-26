import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { loadSwitchesView } from "@/lib/bridge-switches";
import { getSwitchByMac } from "@/lib/db";
import { formatMac, normalizeMac } from "@/lib/mac";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/switches/[mac]">) {
  const { mac: raw } = await params;
  const mac = normalizeMac(raw);
  const user = mac ? await getSessionUser().catch(() => null) : null;
  const item = user && mac ? await getSwitchByMac(user.id, mac).catch(() => null) : null;
  return { title: item?.label?.trim() || (mac ? formatMac(mac) : "Switch") };
}

// The editor itself is rendered by the switches layout (`../layout.tsx`). This page
// only canonicalises the MAC or says the switch is not here.
export default async function SwitchPage({ params }: PageProps<"/switches/[mac]">) {
  const user = await requireSessionUser();
  const { mac: raw } = await params;
  const mac = normalizeMac(raw);
  if (mac && mac !== raw) redirect(`/switches/${mac}`);

  const { switches } = await loadSwitchesView(user.id);
  if (mac && switches.some((item) => item.mac === mac)) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-cream p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Switch not found</h1>
      <p className="max-w-xl text-sm text-muted">
        <span className="font-mono text-foreground">{mac ? formatMac(mac) : raw}</span> is not
        a switch in this account, or its Bridge has not checked in yet.
      </p>
      <Link href="/switches" className="text-sm font-medium text-filament hover:underline">
        Back to switches
      </Link>
    </section>
  );
}
