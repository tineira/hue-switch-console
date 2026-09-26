import {
  getBridge,
  getSwitchByMac,
  incrementSwitchRev,
  isRoundSwitch,
  listPages,
  listRoundRecipes,
  listSimpleChannels,
  persistPageGroupAndDim,
  touchSwitch,
} from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
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

  try {
    const sw = await getSwitchByMac(device.userId, mac);
    if (!sw) return jsonError(404, "not_found");
    await touchSwitch(sw.id, device.keyId);

    if (isRoundSwitch(sw)) {
      const bridge = await getBridge(device.userId, sw.bridgeid);
      const snapshot = snapshotFromJson(bridge?.snapshot);
      const pages = await listPages(sw.id);
      const rawRecipes = await listRoundRecipes(sw.id);
      const recipes = snapshot ? withSceneNames(rawRecipes, snapshot) : rawRecipes;
      const persisted = await persistPageGroupAndDim(sw.id, pages, recipes, snapshot);
      const rev = persisted ? await incrementSwitchRev(sw.id) : sw.rev;
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
      return jsonOk({
        rev,
        product: "round",
        pageSwipeAxis: sw.page_swipe_axis,
        screenTimeoutSec: sw.screen_timeout_sec,
        pages: payloadPages,
        recipes: recipes.map(deviceRoundRecipe),
      });
    }

    // Firmware < 0.3.0 cannot run channel settings: it gets nothing to do
    // until it is reflashed (docs/specs/finished/simple-channel-types.md §3).
    if (!supportsChannelTypes(sw.firmware)) {
      return jsonOk({ rev: sw.rev, recipes: [] });
    }
    const registered = new Set(sw.channels.map((channel) => channel.id));
    const bridge = await getBridge(device.userId, sw.bridgeid);
    const channels = withSnapshotNames(
      (await listSimpleChannels(sw.id)).filter((config) => registered.has(config.id)),
      snapshotFromJson(bridge?.snapshot),
    );
    return jsonOk({
      rev: sw.rev,
      product: "simple",
      channels: channels.map(deviceSimpleChannel),
      recipes: deriveSimpleRecipes(channels).map(deviceSimpleRecipe),
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
