"use client";

// Lights: one map per Bridge (docs/specs/finished/page-structure.md §8,
// docs/specs/finished/design_handoff_lights_map/). Desktop and mobile layouts are both rendered and
// switched by CSS at 1024px, so there is no flash on load.

import Link from "next/link";
import { useMemo } from "react";
import { DesktopMap } from "@/app/lights/desktop-map";
import { MobileMap } from "@/app/lights/mobile-map";
import { StaleBanner } from "@/app/lights/parts";
import type { BridgeSwitch, LoadedBridge } from "@/lib/bridge-switches";
import {
  buildLightsModel,
  countsText,
  snapshotText,
  type LightsModel,
} from "@/lib/lights-map";

export function LightsView({
  bridges,
  switches,
}: {
  bridges: LoadedBridge[];
  switches: BridgeSwitch[];
}) {
  const models = useMemo(
    () =>
      bridges.map((bridge) =>
        buildLightsModel(
          bridge,
          switches.filter((item) => item.bridgeid === bridge.bridgeid),
        ),
      ),
    [bridges, switches],
  );
  const single = models.length === 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-semibold tracking-[-0.02em] lg:text-2xl">Lights</h1>
        {single ? <BridgeMeta model={models[0]} /> : null}
      </section>
      {models.length === 0 ? <EmptyLights /> : null}
      {models.map((model) => (
        <BridgeLights key={model.bridge.bridgeid} model={model} withMeta={!single} />
      ))}
    </div>
  );
}

function BridgeMeta({ model }: { model: LightsModel }) {
  return (
    <p
      className="m-0 flex flex-wrap items-baseline text-[13px] text-muted lg:text-sm"
      style={{ columnGap: 12, rowGap: 4 }}
    >
      <span className="font-mono text-foreground">{model.bridge.bridgeid}</span>
      <span className="lg:hidden">{countsText(model, false)}</span>
      <span className="hidden lg:inline">{countsText(model, true)}</span>
      <span className="hidden lg:inline" suppressHydrationWarning>
        {snapshotText(model.bridge.snapshot)}
      </span>
    </p>
  );
}

function EmptyLights() {
  return (
    <div
      className="flex flex-col items-center border border-dashed border-line bg-cream text-center"
      style={{ borderRadius: 12, padding: "48px 24px", gap: 6 }}
    >
      <p className="m-0 text-base font-medium">No lights yet</p>
      <p className="m-0 max-w-[36ch] text-pretty text-sm text-muted">
        A switch sends them when it checks in. Rooms, zones and scenes appear here too.
      </p>
      <Link href="/setup" className="mt-2 text-sm text-filament hover:text-foreground">
        Set up a switch
      </Link>
    </div>
  );
}

function BridgeLights({ model, withMeta }: { model: LightsModel; withMeta: boolean }) {
  const nLights = Object.keys(model.lights).length;
  return (
    <section aria-label={`Bridge ${model.bridge.bridgeid}`} className="flex flex-col gap-6">
      {withMeta ? <BridgeMeta model={model} /> : null}
      <div className="hidden lg:block">
        <StaleBanner model={model} compact />
      </div>
      <div className="lg:hidden">
        <StaleBanner model={model} compact={false} />
      </div>
      {nLights > 0 && model.switches.length === 0 ? (
        <div
          className="hidden flex-wrap items-baseline border border-line bg-cream text-sm lg:flex"
          style={{ borderRadius: 10, padding: "12px 16px", gap: "4px 12px" }}
        >
          <span className="font-medium">No switches on this Bridge yet.</span>
          <span className="text-muted">
            Nothing below is controlled. The lights came from an earlier check-in.
          </span>
          <Link href="/setup" className="text-[13px] text-filament hover:text-foreground">
            Set up a switch
          </Link>
        </div>
      ) : null}
      {nLights === 0 ? (
        <EmptyLights />
      ) : (
        <>
          <div className="hidden lg:block">
            <DesktopMap model={model} />
          </div>
          <div className="lg:hidden">
            <MobileMap model={model} />
          </div>
        </>
      )}
    </section>
  );
}
