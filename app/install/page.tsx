import { InstallWizard } from "@/app/install/install-wizard";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Install device</h1>
        <p className="max-w-2xl text-sm text-muted">
          Flash a virgin XIAO over USB, then write 2.4 GHz Wi-Fi and a device
          token. This page does not pair Hue and does not wait for the MAC in
          the switch list. The board always uses{" "}
          <code className="font-mono text-xs">https://hue.tineira.com</code>
          — not localhost.
        </p>
      </section>
      <InstallWizard />
    </Shell>
  );
}
