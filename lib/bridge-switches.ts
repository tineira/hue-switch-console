// Server loaders shared by the Bridge layout, the Switches overview and a switch's page
// (docs/specs/page-structure.md).

import { cache } from "react";
import {
  getBridge,
  isRoundSwitch,
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

/** A switch with its saved configuration, as the editor and the overview use it. */
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

/** The Bridge and its snapshot, or null when it is not in this account. Cached per request. */
export const loadBridge = cache(
  async (userId: string, bridgeid: string): Promise<LoadedBridge | null> => {
    if (process.env.DATABASE_URL) {
      await ensureSchema();
    }
    const row = await getBridge(userId, bridgeid);
    if (!row) return null;
    return {
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
    };
  },
);

/**
 * Every switch registered against this Bridge, with channels or pages and recipes.
 * Cached per request: the switches layout and its page both ask.
 */
export const loadBridgeSwitches = cache(async (
  userId: string,
  bridge: LoadedBridge,
): Promise<BridgeSwitch[]> => {
  const all = await listSwitches(userId);
  // Oldest first, so tabs and cards keep their place as boards check in.
  return Promise.all(
    all
      .filter((item) => item.bridgeid === bridge.bridgeid)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map(async (item) => {
        const round = isRoundSwitch(item);
        return {
          ...toSwitchPublic(item),
          simpleChannels: round
            ? []
            : withSnapshotNames(await listSimpleChannels(item.id), bridge.snapshot),
          pages: round ? await listPages(item.id) : [],
          roundRecipes: round
            ? withSceneNames(await listRoundRecipes(item.id), bridge.snapshot)
            : [],
        };
      }),
  );
});

/** The current uploaded release per product; "" when none or on error. */
export const latestFirmware = cache(async (): Promise<{ round: string; simple: string }> => {
  const [round, simple] = await Promise.all([
    currentVersion("round").catch(() => null),
    currentVersion("simple").catch(() => null),
  ]);
  return { round: round ?? "", simple: simple ?? "" };
});
