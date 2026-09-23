import { DevicesPanel } from "@/app/devices/devices-panel";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Devices",
};

export default async function DevicesPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="max-w-2xl text-sm text-muted">
          Plug a XIAO into this computer over USB to install firmware, save
          Wi-Fi, and link it to this console. Use Chrome or Edge.
        </p>
      </section>
      <DevicesPanel />
    </Shell>
  );
}
