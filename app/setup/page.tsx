import { SetupPanel } from "@/app/setup/setup-panel";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { getSwitchByMac } from "@/lib/db";
import { formatMac, normalizeMac } from "@/lib/mac";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireSessionUser();
  const { mac: rawMac } = await searchParams;
  const mac = typeof rawMac === "string" ? normalizeMac(rawMac) : null;
  const expected = mac ? await getSwitchByMac(user.id, mac).catch(() => null) : null;

  return (
    <Shell email={user.email} userId={user.id}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <p className="max-w-2xl text-sm text-muted">
          Plug a switch into this computer over USB to install or update
          firmware, save Wi-Fi, and link it to this console. Use Chrome or Edge.
        </p>
      </section>
      <SetupPanel
        expected={
          expected
            ? { mac: expected.mac, name: expected.label?.trim() || formatMac(expected.mac) }
            : null
        }
      />
    </Shell>
  );
}
