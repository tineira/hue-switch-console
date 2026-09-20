import {
  getBridge,
  getSwitchByMac,
  isRoundSwitch,
  listPages,
  listRecipes,
  listRoundRecipes,
  touchSwitch,
} from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import {
  computeDimTarget,
  deviceRoundPage,
  deviceRoundRecipe,
  withSceneNames,
} from "@/lib/pages";
import { snapshotFromJson } from "@/lib/recipes";
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
    await touchSwitch(sw.id);

    if (isRoundSwitch(sw)) {
      const bridge = await getBridge(device.userId, sw.bridgeid);
      const snapshot = snapshotFromJson(bridge?.snapshot);
      const pages = await listPages(sw.id);
      const rawRecipes = await listRoundRecipes(sw.id);
      const recipes = snapshot ? withSceneNames(rawRecipes, snapshot) : rawRecipes;
      const payloadPages = pages.map((page) => {
        const dimTarget = snapshot
          ? computeDimTarget(
              recipes.filter((recipe) => recipe.pageId === page.id),
              snapshot,
            )
          : page.dimTarget;
        return deviceRoundPage({ ...page, dimTarget });
      });
      return jsonOk({
        rev: sw.rev,
        product: "round",
        pageSwipeAxis: sw.page_swipe_axis,
        pages: payloadPages,
        recipes: recipes.map(deviceRoundRecipe),
      });
    }

    const recipes = await listRecipes(sw.id);
    return jsonOk({ rev: sw.rev, recipes });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
