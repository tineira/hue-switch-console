import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { listBridges } from "@/lib/db";

export const dynamic = "force-dynamic";

// Nav target outside a Bridge: the only Bridge's switches, or the Bridge picker.
export default async function SwitchesIndexPage() {
  const user = await requireSessionUser();
  const bridges = await listBridges(user.id);
  redirect(
    bridges.length === 1
      ? `/bridges/${encodeURIComponent(bridges[0].bridgeid)}/switches`
      : "/",
  );
}
