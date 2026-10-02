import { LightsView } from "@/app/lights/lights-view";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { loadSwitchesView } from "@/lib/bridge-switches";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lights",
};

export default async function LightsPage() {
  const user = await requireSessionUser();
  const { bridges, switches } = await loadSwitchesView(user.id);
  return (
    <Shell email={user.email}>
      <LightsView bridges={bridges} switches={switches} />
    </Shell>
  );
}
