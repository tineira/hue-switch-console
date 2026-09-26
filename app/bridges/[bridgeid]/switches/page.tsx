import Link from "next/link";
import { BridgeContext } from "@/app/bridges/[bridgeid]/bridge-context";
import { agoText, minutesSince } from "@/lib/ago";
import { requireSessionUser } from "@/lib/auth";
import {
  latestFirmware,
  loadBridge,
  loadBridgeSwitches,
  type BridgeSwitch,
} from "@/lib/bridge-switches";
import { listBridges } from "@/lib/db";
import { gesturesLine, roundPageGestures, simpleChannelGestures } from "@/lib/gestures";
import { formatMac } from "@/lib/mac";
import { staleRoundCount } from "@/lib/pages";
import {
  groupRoom,
  isSimpleChannelStale,
  supportsChannelTypes,
} from "@/lib/simple-channels";
import type { TopologySnapshot } from "@/lib/types";
import { compareVersions } from "@/lib/web-setup/devices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Switches",
};

// Boards with recipes poll hourly (docs/definitions.md, "Polling"): three missed polls.
const NOT_SEEN_MIN = 180;
const MAX_ROUND_LINES = 3;

export default async function SwitchesPage({
  params,
}: PageProps<"/bridges/[bridgeid]/switches">) {
  const user = await requireSessionUser();
  const { bridgeid } = await params;
  const bridge = await loadBridge(user.id, bridgeid);
  if (!bridge) return null; // The layout shows "Bridge not found".
  const [switches, latest, bridges] = await Promise.all([
    loadBridgeSwitches(user.id, bridge),
    latestFirmware(),
    listBridges(user.id),
  ]);
  const { snapshot } = bridge;
  const topologyEmpty =
    snapshot.lights.length === 0 && snapshot.rooms.length === 0 && snapshot.scenes.length === 0;
  const base = `/bridges/${encodeURIComponent(bridge.bridgeid)}/switches`;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Switches</h1>
          <BridgeContext bridge={bridge} multipleBridges={bridges.length > 1} />
        </div>
        <Link
          href="/setup"
          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
        >
          Add a switch
        </Link>
      </section>

      {topologyEmpty ? (
        <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No lights yet</p>
          <p className="mt-2">
            A switch paired with this Bridge sends its rooms, lights, and scenes
            when it checks in.
          </p>
        </div>
      ) : null}

      {switches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No switches on this Bridge</p>
          <p className="mt-2">
            Set up a board on{" "}
            <Link href="/setup" className="text-filament underline underline-offset-2">
              Setup
            </Link>
            . It shows up here once it pairs with this Bridge.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {switches.map((item) => (
            <SwitchCard
              key={item.mac}
              item={item}
              snapshot={snapshot}
              href={`${base}/${item.mac}`}
              latest={item.product === "round" ? latest.round : latest.simple}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SwitchCard({
  item,
  snapshot,
  href,
  latest,
}: {
  item: BridgeSwitch;
  snapshot: TopologySnapshot;
  href: string;
  latest: string;
}) {
  const round = item.product === "round";
  const name = item.label?.trim() || formatMac(item.mac);
  const update = compareVersions(item.firmware ?? "", latest) === -1 ? latest : null;
  const seenMin = minutesSince(item.last_seen_at);
  const { lines, unused } = round ? roundLines(item, snapshot) : simpleLines(item, snapshot);
  const stale = round
    ? staleRoundCount(item.roundRecipes, snapshot)
    : item.simpleChannels.filter((config) => isSimpleChannelStale(config, snapshot)).length;
  const warnings: string[] = [];
  if (stale > 0) {
    warnings.push(
      `${stale} gesture${stale === 1 ? " points" : "s point"} at lights or scenes no longer on the Bridge.`,
    );
  }
  if (seenMin !== null && seenMin > NOT_SEEN_MIN) {
    warnings.push(`Not seen for ${notSeenText(seenMin)}.`);
  }
  if (!round && !supportsChannelTypes(item.firmware)) {
    warnings.push("Firmware too old to edit channels. Update it.");
  }

  return (
    <li className="relative flex flex-col gap-2 rounded-xl border border-line bg-cream px-5 py-4 hover:border-filament/40">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href}
          className="truncate text-base font-medium after:absolute after:inset-0 after:rounded-xl"
        >
          {name}
        </Link>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
          {round ? "Round" : "Simple"}
        </span>
        {update ? (
          <Link
            href={`/setup?mac=${item.mac}`}
            title="Plug the board in over USB and install from Setup"
            className="relative z-10 rounded-full border border-filament/50 px-2 py-0.5 text-[11px] font-medium text-filament hover:bg-filament-soft"
          >
            Update to {update}
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        <span className="font-mono">{formatMac(item.mac)}</span>
        {item.firmware ? ` · firmware ${item.firmware}` : ""}
        {` · rev ${item.rev}`}
        {seenMin === null ? " · never seen" : ` · seen ${agoText(seenMin)}`}
      </p>
      {lines.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {unused ? <li className="text-muted">{unused}</li> : null}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing set up yet.</p>
      )}
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-warn">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function roundLines(
  item: BridgeSwitch,
  snapshot: TopologySnapshot,
): { lines: string[]; unused: string | null } {
  const lines = item.pages.slice(0, MAX_ROUND_LINES).map((page) => {
    if (!page.group) return `${page.name} · No room or zone yet`;
    const gestures = roundPageGestures(page.id, item.roundRecipes, snapshot).filter(
      (gesture) => gesture.action !== "none",
    );
    return gestures.length > 0
      ? `${page.name} · ${gesturesLine(gestures)}`
      : `${page.name} · Does nothing`;
  });
  const more = item.pages.length - MAX_ROUND_LINES;
  if (more > 0) lines.push(`+${more} more page${more === 1 ? "" : "s"}`);
  return { lines, unused: null };
}

function simpleLines(
  item: BridgeSwitch,
  snapshot: TopologySnapshot,
): { lines: string[]; unused: string | null } {
  const lines: string[] = [];
  const unused: string[] = [];
  for (const channel of item.channels) {
    const config = item.simpleChannels.find((candidate) => candidate.id === channel.id);
    if (!config) {
      unused.push(channel.label);
      continue;
    }
    const room = groupRoom(snapshot, config.group)?.name ?? "Unknown group";
    const gestures = simpleChannelGestures(config, snapshot).filter(
      (gesture) => gesture.action !== "none",
    );
    lines.push(`${channel.label} · ${room} · ${gesturesLine(gestures)}`);
  }
  return {
    lines,
    unused: unused.length > 0 ? `${unused.join(", ")} not used` : null,
  };
}

function notSeenText(min: number): string {
  const hours = Math.round(min / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}
