import Link from "next/link";
import { BridgeWorkspace } from "@/app/bridges/[bridgeid]/workspace";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import {
  getBridge,
  isRoundSwitch,
  listPages,
  listRecipes,
  listRoundRecipes,
  listSwitches,
  toSwitchPublic,
} from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { withSceneNames } from "@/lib/pages";
import { snapshotFromJson } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export default async function BridgePage({
  params,
}: {
  params: Promise<{ bridgeid: string }>;
}) {
  const user = await requireSessionUser();
  if (process.env.DATABASE_URL) {
    await ensureSchema();
  }
  const { bridgeid } = await params;
  const [row, allSwitches] = await Promise.all([
    getBridge(user.id, bridgeid),
    listSwitches(user.id),
  ]);

  if (!row) {
    return (
      <Shell email={user.email}>
        <section className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-cream p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bridge not found
          </h1>
          <p className="max-w-xl text-sm text-muted">
            No snapshot for <span className="font-mono text-foreground">{bridgeid}</span>{" "}
            in this account. Topology is uploaded by a switch or{" "}
            <code className="font-mono text-xs">push-from-bridge</code> — this
            app never calls the Hue Bridge.
          </p>
          <Link href="/" className="text-sm font-medium text-filament hover:underline">
            Back to bridges
          </Link>
        </section>
      </Shell>
    );
  }

  const snapshot = snapshotFromJson(row.snapshot) ?? {
    receivedAt: row.updated_at,
    bridgeid: row.bridgeid,
    lights: [],
    rooms: [],
    scenes: [],
  };
  const switches = await Promise.all(
    allSwitches
      .filter((item) => item.bridgeid === row.bridgeid)
      .map(async (item) => {
        const round = isRoundSwitch(item);
        return {
          ...toSwitchPublic(item),
          recipes: round ? [] : await listRecipes(item.id),
          pages: round ? await listPages(item.id) : [],
          roundRecipes: round
            ? withSceneNames(await listRoundRecipes(item.id), snapshot)
            : [],
        };
      }),
  );

  return (
    <Shell email={user.email} wide>
      <BridgeWorkspace
        bridgeid={row.bridgeid}
        bridgeIp={row.bridge_ip}
        updatedAt={row.updated_at}
        snapshot={snapshot}
        switches={switches}
      />
    </Shell>
  );
}
