// Server loaders for the Switches page (docs/specs/finished/page-structure.md): every Bridge of
// the account and every switch registered against one of them.

import { cache } from "react";
import {
  isRoundSwitch,
  listBridges,
  listPages,
  listRoundRecipes,
  listSimpleChannels,
  listSwitches,
  toSwitchPublic,
} from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { currentVersion } from "@/lib/firmware";
import { withSceneNames } from "@/lib/pages";
import { snapshotFromJson } from "@/lib/recipes";
import { withSnapshotNames } from "@/lib/simple-channels";
import type {
  RoundRecipe,
  SimpleChannelConfig,
  SwitchPage,
  SwitchPublic,
  TopologySnapshot,
} from "@/lib/types";

/** A switch with its saved configuration, as the editor uses it. */
export type BridgeSwitch = SwitchPublic & {
  simpleChannels: SimpleChannelConfig[];
  pages: SwitchPage[];
  roundRecipes: RoundRecipe[];
};

export type LoadedBridge = {
  bridgeid: string;
  bridgeIp: string | null;
  updatedAt: string;
  snapshot: TopologySnapshot;
};

/**
 * Every Bridge (most recently updated first) and every switch whose Bridge is known,
 * oldest switch first so tabs keep their place as boards check in.
 * Cached per request: the layout and its pages both ask.
 */
export const loadSwitchesView = cache(
  async (userId: string): Promise<{ bridges: LoadedBridge[]; switches: BridgeSwitch[] }> => {
    if (process.env.DATABASE_URL) {
      await ensureSchema();
    }
    const [bridgeRows, switchRows] = await Promise.all([
      listBridges(userId),
      listSwitches(userId),
    ]);
    const bridges: LoadedBridge[] = bridgeRows.map((row) => ({
      bridgeid: row.bridgeid,
      bridgeIp: row.bridge_ip,
      updatedAt: row.updated_at,
      snapshot: snapshotFromJson(row.snapshot) ?? {
        receivedAt: row.updated_at,
        bridgeid: row.bridgeid,
        lights: [],
        rooms: [],
        scenes: [],
      },
    }));
    const byId = new Map(bridges.map((bridge) => [bridge.bridgeid, bridge]));
    const switches = await Promise.all(
      switchRows
        .filter((item) => byId.has(item.bridgeid))
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
        .map(async (item): Promise<BridgeSwitch> => {
          const snapshot = (byId.get(item.bridgeid) as LoadedBridge).snapshot;
          const round = isRoundSwitch(item);
          return {
            ...toSwitchPublic(item),
            simpleChannels: round
              ? []
              : withSnapshotNames(await listSimpleChannels(item.id), snapshot),
            pages: round ? await listPages(item.id) : [],
            roundRecipes: round
              ? withSceneNames(await listRoundRecipes(item.id), snapshot)
              : [],
          };
        }),
    );
    return { bridges, switches };
  },
);

/** The current uploaded release per product; "" when none or on error. */
export const latestFirmware = cache(async (): Promise<{ round: string; simple: string }> => {
  const [round, simple] = await Promise.all([
    currentVersion("round").catch(() => null),
    currentVersion("simple").catch(() => null),
  ]);
  return { round: round ?? "", simple: simple ?? "" };
});
