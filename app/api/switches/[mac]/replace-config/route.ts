import { getSessionUser } from "@/lib/auth";
import { EDITING_WINDOW_MIN } from "@/lib/config-sync";
import {
  bumpSwitchRevPast,
  getSwitchByMac,
  markSwitchEditing,
  toSwitchPublic,
} from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { normalizeMac } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * A switch ahead of the console keeps its own config. This moves `rev` past the
 * switch's so its next poll replaces NVS with what the console has, even when that
 * is nothing (docs/specs/config-sync.md §4.4).
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ mac: string }> },
) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  const { mac: rawMac } = await context.params;
  const mac = normalizeMac(rawMac);
  if (!mac) return jsonError(400, "mac must be 12 hex digits");
  try {
    const sw = await getSwitchByMac(user.id, mac);
    if (!sw) return jsonError(404, "not_found");
    if (sw.applied_rev === null || sw.applied_rev <= sw.rev) {
      return jsonError(409, "not_ahead", {
        details: "This switch is not ahead of the console.",
      });
    }
    await bumpSwitchRevPast(sw.id, sw.applied_rev);
    await markSwitchEditing(sw.id, EDITING_WINDOW_MIN);
    const updated = await getSwitchByMac(user.id, mac);
    return jsonOk({ ok: true, ...toSwitchPublic(updated ?? sw) });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
