import { getSessionUser } from "@/lib/auth";
import {
  getBridge,
  getSwitchByMac,
  listRecipes,
  replaceRecipes,
  toSwitchPublic,
} from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { parseRecipes } from "@/lib/parse";
import { snapshotFromJson, validateRecipes } from "@/lib/recipes";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");

  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    const recipes = await listRecipes(sw.id);
    return jsonOk({ ...toSwitchPublic(sw), recipes });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  const recipes = parseRecipes((body as { recipes?: unknown })?.recipes);
  if (!recipes) {
    return jsonError(400, "recipes[] is required");
  }

  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    const bridge = await getBridge(user.id, sw.bridgeid);
    const snapshot = snapshotFromJson(bridge?.snapshot);
    if (!snapshot) {
      return jsonError(400, "no topology snapshot for this bridge");
    }
    const invalid = validateRecipes(recipes, sw.channels ?? [], snapshot);
    if (invalid) return jsonError(400, "validation_error", { details: invalid });

    const rev = await replaceRecipes(sw.id, recipes);
    return jsonOk({ ok: true, mac, rev, recipes });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
