import Link from "next/link";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { loadBridge } from "@/lib/bridge-switches";

export const dynamic = "force-dynamic";

export default async function BridgeLayout({
  children,
  params,
}: LayoutProps<"/bridges/[bridgeid]">) {
  const user = await requireSessionUser();
  const { bridgeid } = await params;
  const bridge = await loadBridge(user.id, bridgeid);

  return (
    <Shell email={user.email} wide>
      {bridge ? (
        children
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-cream p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Bridge not found</h1>
          <p className="max-w-xl text-sm text-muted">
            <span className="font-mono text-foreground">{bridgeid}</span>{" "}
            is not in this account yet. It appears once a switch paired with it
            checks in.
          </p>
          <Link href="/" className="text-sm font-medium text-filament hover:underline">
            Back to bridges
          </Link>
        </section>
      )}
    </Shell>
  );
}
