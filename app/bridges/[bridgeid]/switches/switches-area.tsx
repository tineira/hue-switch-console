"use client";

import { BridgeWorkspace } from "@/app/bridges/[bridgeid]/workspace";
import type { BridgeSwitch } from "@/lib/bridge-switches";
import type { TopologySnapshot } from "@/lib/types";
import { usePathname } from "next/navigation";

/**
 * Shows the editor when the URL names a switch of this Bridge, otherwise the page
 * (the overview, or `[mac]/page.tsx` for a redirect or "not found").
 */
export function SwitchesArea({
  bridgeid,
  snapshot,
  switches,
  latestFirmware,
  children,
}: {
  bridgeid: string;
  snapshot: TopologySnapshot;
  switches: BridgeSwitch[];
  latestFirmware: { round: string; simple: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prefix = `/bridges/${encodeURIComponent(bridgeid)}/switches/`;
  const mac = pathname.startsWith(prefix) ? pathname.slice(prefix.length).split("/")[0] : null;
  const editing = mac !== null && switches.some((item) => item.mac === mac);

  return (
    <>
      {children}
      {editing ? (
        <BridgeWorkspace
          bridgeid={bridgeid}
          snapshot={snapshot}
          switches={switches}
          latestFirmware={latestFirmware}
        />
      ) : null}
    </>
  );
}
