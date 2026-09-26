import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { loadSwitchesView } from "@/lib/bridge-switches";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Switches",
};

// Opens the first switch; the page itself only shows when there is none yet.
export default async function SwitchesIndexPage() {
  const user = await requireSessionUser();
  const { bridges, switches } = await loadSwitchesView(user.id);
  if (switches.length > 0) redirect(`/switches/${switches[0].mac}`);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Switches</h1>
        <p className="max-w-2xl text-sm text-muted">
          Each switch belongs to the Hue Bridge it paired with and uses that
          Bridge&apos;s rooms, lights, and scenes.
        </p>
      </section>
      <section className="flex flex-col gap-4 rounded-xl border border-dashed border-line bg-cream p-6">
        <h2 className="text-lg font-medium">
          {bridges.length === 0 ? "No Bridge yet" : "No switches yet"}
        </h2>
        <ol className="flex max-w-xl list-decimal flex-col gap-2 pl-5 text-sm text-muted">
          <li>Set up a board on Setup, in Chrome or Edge.</li>
          <li>When the board asks, press the button on the Hue Bridge.</li>
          <li>
            Come back here. The switch and its Bridge&apos;s rooms, lights, and
            scenes appear once the board checks in.
          </li>
        </ol>
        <p>
          <Link
            href="/setup"
            className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
          >
            Go to Setup
          </Link>
        </p>
      </section>
    </div>
  );
}
