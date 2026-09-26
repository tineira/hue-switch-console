import { getSessionUser } from "@/lib/auth";
import { EDITING_WINDOW_MIN } from "@/lib/config-sync";
import { listSwitches, markSwitchesEditing, toSwitchPublic } from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * The Switches area calls this while it is open: every switch of the account polls
 * fast for the next few minutes, and the reply carries each switch's config status
 * (docs/specs/finished/config-sync.md §4.3, §4.6).
 */
export async function POST() {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    await ensureSchema();
    await markSwitchesEditing(user.id, EDITING_WINDOW_MIN);
    const switches = (await listSwitches(user.id)).map(toSwitchPublic);
    return jsonOk({
      switches: switches.map((item) => ({
        mac: item.mac,
        rev: item.rev,
        applied_rev: item.applied_rev,
        config_status: item.config_status,
        rev_changed_at: item.rev_changed_at,
        next_poll_at: item.next_poll_at,
        last_seen_at: item.last_seen_at,
      })),
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
