import { Shell } from "@/app/shell";
import { SwitchesArea } from "@/app/switches/switches-area";
import { requireSessionUser } from "@/lib/auth";
import { latestFirmware, loadSwitchesView } from "@/lib/bridge-switches";
import { listReleaseNotes } from "@/lib/firmware";

export const dynamic = "force-dynamic";

// The switch editor lives here, not in `[mac]/page.tsx`: a layout stays mounted when the
// switch in the URL changes, so drafts survive tabs, Back / Forward and a refresh.
export default async function SwitchesLayout({ children }: LayoutProps<"/switches">) {
  const user = await requireSessionUser();
  const [{ bridges, switches }, latest, roundNotes, simpleNotes] = await Promise.all([
    loadSwitchesView(user.id),
    latestFirmware(),
    listReleaseNotes("round").catch(() => []),
    listReleaseNotes("simple").catch(() => []),
  ]);
  return (
    <Shell email={user.email} userId={user.id} wide>
      <SwitchesArea
        bridges={bridges}
        switches={switches}
        latestFirmware={latest}
        releaseNotes={{ round: roundNotes, simple: simpleNotes }}
      >
        {children}
      </SwitchesArea>
    </Shell>
  );
}
