import Link from "next/link";
import { ForcePanel } from "@/app/devices/force/force-panel";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Force install",
};

export default async function ForceInstallPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Force install</h1>
        <p className="max-w-2xl text-sm text-muted">
          Pick the board, then the USB port. The page writes that firmware
          without reading a stored card. Hold BOOT before you continue. If the
          chip names itself and it is the other one, nothing is written.
        </p>
        <p className="text-sm">
          <Link href="/devices" className="text-filament hover:underline">
            Back to Devices
          </Link>
        </p>
      </section>
      <ForcePanel />
    </Shell>
  );
}
