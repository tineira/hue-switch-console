import Link from "next/link";
import { DevicesPanel } from "@/app/devices/devices-panel";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="max-w-2xl text-sm text-muted">
          Detect a XIAO over USB. Install, Wi-Fi, and the device token are
          actions on this page. The token is written to the board and is not
          shown. Provisioning is done when Wi-Fi and the token are saved. This
          page does not call the Hue Bridge and does not wait for the switch
          list. If the port will not identify,{" "}
          <Link href="/devices/force" className="text-filament hover:underline">
            force a firmware write
          </Link>
          . The board uses{" "}
          <code className="font-mono text-xs">https://hue.tineira.com</code>.
        </p>
      </section>
      <DevicesPanel />
    </Shell>
  );
}
