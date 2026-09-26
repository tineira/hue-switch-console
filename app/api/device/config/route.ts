import { NextResponse } from "next/server";
import { parseReportedRev, pollSecFor } from "@/lib/config-sync";
import {
  bumpSwitchRevPast,
  getBridge,
  getSwitchByMac,
  incrementSwitchRev,
  isRoundSwitch,
  listPages,
  listRoundRecipes,
  listSimpleChannels,
  persistPageGroupAndDim,
  recordConfigPoll,
} from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError } from "@/lib/http";
import {
  computeDim,
  deviceRoundPage,
  deviceRoundRecipe,
  inferPageGroup,
  resolvePageGroup,
  withSceneNames,
} from "@/lib/pages";
import { snapshotFromJson } from "@/lib/recipes";
import {
  deriveSimpleRecipes,
  deviceSimpleChannel,
  deviceSimpleRecipe,
  supportsChannelTypes,
  withSnapshotNames,
} from "@/lib/simple-channels";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }

  try {
    await ensureSchema();
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }

  let device;
  try {
    device = await authenticateDevice(req);
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
  if (!device) return jsonError(401, "unauthorized");

  const url = new URL(req.url);
  const mac = normalizeMac(url.searchParams.get("mac") ?? "");
  if (!mac) return jsonError(400, "mac query parameter is required");
  // Optional: the revision in the switch's NVS (docs/specs/config-sync.md §2.1).
  const reported = parseReportedRev(url.searchParams.get("rev"));

  try {
    const sw = await getSwitchByMac(device.userId, mac);
    if (!sw) return jsonError(404, "not_found");

    // A switch holding a higher revision than ours keeps its NVS and ignores us.
    // When we have a config for it, move past that revision so ours wins (§4.4).
    const serve = async (rev: number, hasConfig: boolean) =>
      reported !== null && reported > rev && hasConfig
        ? bumpSwitchRevPast(sw.id, reported)
        : rev;

    let rev: number;
    let hasConfig: boolean;
    let body: Record<string, unknown>;
    if (isRoundSwitch(sw)) {
      const bridge = await getBridge(device.userId, sw.bridgeid);
      const snapshot = snapshotFromJson(bridge?.snapshot);
      const pages = await listPages(sw.id);
      const rawRecipes = await listRoundRecipes(sw.id);
      const recipes = snapshot ? withSceneNames(rawRecipes, snapshot) : rawRecipes;
      const persisted = await persistPageGroupAndDim(sw.id, pages, recipes, snapshot);
      // Every Round has a default page; it is configured once a gesture is set.
      hasConfig = recipes.length > 0;
      rev = await serve(persisted ? await incrementSwitchRev(sw.id) : sw.rev, hasConfig);
      const filled = await listPages(sw.id);
      const payloadPages = filled.map((page) => {
        const pageRecipes = recipes.filter((recipe) => recipe.pageId === page.id);
        const group = snapshot
          ? (resolvePageGroup(snapshot, page.group) ??
            inferPageGroup(pageRecipes, snapshot) ??
            page.group)
          : page.group;
        const dim = computeDim(pageRecipes, group?.groupedLightRid, snapshot);
        return deviceRoundPage({ ...page, group, dim });
      });
      body = {
        rev,
        product: "round",
        pageSwipeAxis: sw.page_swipe_axis,
        screenTimeoutSec: sw.screen_timeout_sec,
        pages: payloadPages,
        recipes: recipes.map(deviceRoundRecipe),
      };
    } else if (!supportsChannelTypes(sw.firmware)) {
      // Firmware < 0.3.0 cannot run channel settings: it gets nothing to do
      // until it is reflashed (docs/specs/finished/simple-channel-types.md §3).
      hasConfig = true;
      rev = sw.rev;
      body = { rev, recipes: [] };
    } else {
      const registered = new Set(sw.channels.map((channel) => channel.id));
      const bridge = await getBridge(device.userId, sw.bridgeid);
      const channels = withSnapshotNames(
        (await listSimpleChannels(sw.id)).filter((config) => registered.has(config.id)),
        snapshotFromJson(bridge?.snapshot),
      );
      hasConfig = channels.length > 0;
      rev = await serve(sw.rev, hasConfig);
      body = {
        rev,
        product: "simple",
        channels: channels.map(deviceSimpleChannel),
        recipes: deriveSimpleRecipes(channels).map(deviceSimpleRecipe),
      };
    }

    const pollSec = pollSecFor({
      hasConfig,
      editingUntil: sw.editing_until,
      behind: reported !== null && reported < rev,
    });
    await recordConfigPoll({
      id: sw.id,
      apiKeyId: device.keyId,
      reported,
      // Served this config before and still reports an older one: it did not keep it.
      applyFailed: reported !== null && sw.served_rev !== null && reported < sw.served_rev,
      servedRev: rev,
      pollSec,
    });

    const headers = { "X-Poll-Sec": String(pollSec) };
    if (reported === rev) {
      return new Response(null, { status: 204, headers });
    }
    return NextResponse.json({ ...body, pollSec }, { headers });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
