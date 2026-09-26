// Config sync: how often a switch polls and whether it runs the current revision
// (docs/specs/finished/config-sync.md).

export type ConfigStatus = "current" | "pending" | "not_applied" | "ahead" | "unknown";

/** Poll intervals the console hands out. The firmware clamps to 30–3600 s. */
export const POLL_FAST_SEC = 30;
export const POLL_IDLE_SEC = 900;

/** How long the Switches area counts as "editing" after a load, heartbeat or save. */
export const EDITING_WINDOW_MIN = 15;
/** The Switches area refreshes statuses (and the editing window) this often while visible. */
export const SYNC_REFRESH_MS = 30 * 1000;

/** The `rev` query parameter; null when missing or not a non-negative integer. */
export function parseReportedRev(raw: string | null): number | null {
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
}

export function pollSecFor(input: {
  hasConfig: boolean;
  editingUntil: string | null;
  /** The switch reported an older revision than the one it is being served. */
  behind: boolean;
  now?: number;
}): number {
  if (!input.hasConfig) return POLL_FAST_SEC;
  const now = input.now ?? Date.now();
  if (input.editingUntil && Date.parse(input.editingUntil) > now) return POLL_FAST_SEC;
  if (input.behind) return POLL_FAST_SEC;
  return POLL_IDLE_SEC;
}

export function configStatus(row: {
  rev: number;
  applied_rev: number | null;
  apply_failed: boolean;
}): ConfigStatus {
  if (row.applied_rev === null) return "unknown";
  if (row.applied_rev > row.rev) return "ahead";
  if (row.applied_rev === row.rev) return "current";
  if (row.apply_failed) return "not_applied";
  return "pending";
}
