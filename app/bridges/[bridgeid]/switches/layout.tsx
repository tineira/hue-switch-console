import { SwitchesArea } from "@/app/bridges/[bridgeid]/switches/switches-area";
import { requireSessionUser } from "@/lib/auth";
import { latestFirmware, loadBridge, loadBridgeSwitches } from "@/lib/bridge-switches";

export const dynamic = "force-dynamic";

// The switch editor lives here, not in `[mac]/page.tsx`: a layout keeps it mounted when
// the switch in the URL changes, so drafts survive tabs, Back / Forward and a refresh.
export default async function SwitchesLayout({
  children,
  params,
}: LayoutProps<"/bridges/[bridgeid]/switches">) {
  const user = await requireSessionUser();
  const { bridgeid } = await params;
  const bridge = await loadBridge(user.id, bridgeid);
  if (!bridge) return children; // The Bridge layout shows "Bridge not found".
  const [switches, latest] = await Promise.all([
    loadBridgeSwitches(user.id, bridge),
    latestFirmware(),
  ]);
  return (
    <SwitchesArea
      bridgeid={bridge.bridgeid}
      snapshot={bridge.snapshot}
      switches={switches}
      latestFirmware={latest}
    >
      {children}
    </SwitchesArea>
  );
}
