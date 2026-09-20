import { getSessionUser } from "@/lib/auth";
import {
  getBridge,
  getSwitchByMac,
  isRoundSwitch,
  listPages,
  listRoundRecipes,
  replaceRoundConfig,
  toSwitchPublic,
} from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import {
  parsePageSwipeAxis,
  parseRoundPages,
  parseRoundRecipes,
  parseScreenTimeoutSec,
} from "@/lib/parse";
import {
  DEFAULT_SCREEN_TIMEOUT_SEC,
  validateRoundConfig,
  withSceneNames,
} from "@/lib/pages";
import { snapshotFromJson } from "@/lib/recipes";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    await ensureSchema();
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");

  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    if (!isRoundSwitch(sw)) {
      return jsonError(400, "not_a_round_display");
    }
    const bridge = await getBridge(user.id, sw.bridgeid);
    const snapshot = snapshotFromJson(bridge?.snapshot);
    const pages = await listPages(sw.id);
    const recipes = await listRoundRecipes(sw.id);
    return jsonOk({
      ...toSwitchPublic(sw),
      pages,
      recipes: snapshot ? withSceneNames(recipes, snapshot) : recipes,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    await ensureSchema();
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_payload");
  }
  const raw = body as Record<string, unknown>;
  const pageSwipeAxis = parsePageSwipeAxis(raw.pageSwipeAxis) ?? "horizontal";
  const parsedTimeout = parseScreenTimeoutSec(raw.screenTimeoutSec);
  if (parsedTimeout === null) {
    return jsonError(400, "screenTimeoutSec must be 0 or 10–600");
  }
  const screenTimeoutSec = parsedTimeout ?? DEFAULT_SCREEN_TIMEOUT_SEC;
  const pages = parseRoundPages(raw.pages);
  const recipes = parseRoundRecipes(raw.recipes);
  if (!pages || !recipes) {
    return jsonError(400, "pages[] and recipes[] are required");
  }

  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    if (!isRoundSwitch(sw)) {
      return jsonError(400, "not_a_round_display");
    }
    const bridge = await getBridge(user.id, sw.bridgeid);
    const snapshot = snapshotFromJson(bridge?.snapshot);
    if (!snapshot) {
      return jsonError(400, "no topology snapshot for this bridge");
    }
    const invalid = validateRoundConfig(pages, recipes, snapshot);
    if (invalid) return jsonError(400, "validation_error", { details: invalid });

    const saved = await replaceRoundConfig(sw, {
      pageSwipeAxis,
      screenTimeoutSec,
      pages,
      recipes,
      snapshot,
    });
    return jsonOk({
      ok: true,
      mac,
      rev: saved.rev,
      product: "round",
      pageSwipeAxis: saved.pageSwipeAxis,
      screenTimeoutSec: saved.screenTimeoutSec,
      pages: saved.pages,
      recipes: saved.recipes,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
