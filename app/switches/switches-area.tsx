"use client";

import { SwitchesWorkspace } from "@/app/switches/workspace";
import type { BridgeSwitch, LoadedBridge } from "@/lib/bridge-switches";
import { usePathname } from "next/navigation";

/**
 * Shows the editor when the URL names a switch of this account, otherwise the page
 * (the empty states on `/switches`, or "not found" from `[mac]/page.tsx`).
 */
export function SwitchesArea({
  bridges,
  switches,
  latestFirmware,
  children,
}: {
  bridges: LoadedBridge[];
  switches: BridgeSwitch[];
  latestFirmware: { round: string; simple: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const mac = pathname.startsWith("/switches/") ? pathname.split("/")[2] : null;
  const editing = mac !== null && switches.some((item) => item.mac === mac);

  return (
    <>
      {children}
      {editing ? (
        <SwitchesWorkspace
          bridges={bridges}
          switches={switches}
          latestFirmware={latestFirmware}
        />
      ) : null}
    </>
  );
}
