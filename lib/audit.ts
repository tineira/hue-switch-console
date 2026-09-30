import { sql } from "@/lib/sql";

// What admins did, newest first (docs/specs/finished/admin-tools.md §2.5). Kept 1 year.

export type AdminAction =
  | "suspend"
  | "unsuspend"
  | "delete_account"
  | "limits"
  | "invite_create"
  | "invite_email"
  | "invite_revoke"
  | "waitlist_admit"
  | "waitlist_remove"
  | "settings"
  | "firmware_current"
  | "waitlist_auto_admit"
  | "firmware_upload"
  | "notice_dismiss";

// Events nobody clicked: the console acting on its own, or firmware CI uploading a release. They
// go in admin_email with these names, which no admin address can take.
export const CONSOLE_ACTOR = "system:console";
export const FIRMWARE_CI_ACTOR = "system:firmware-ci";

/** Records an event without letting a logging failure break the request that caused it. */
export async function recordSystemEvent(input: Parameters<typeof recordAdminEvent>[0]) {
  try {
    await recordAdminEvent(input);
  } catch (err) {
    console.error("admin event not recorded", err);
  }
}

export type AdminEvent = {
  id: string;
  admin_email: string;
  action: AdminAction;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export async function recordAdminEvent(input: {
  adminEmail: string | undefined;
  action: AdminAction;
  targetUserId?: string | null;
  target?: string | null;
  details?: Record<string, unknown> | null;
}) {
  await sql()`
    insert into admin_events (admin_email, action, target_user_id, target, details)
    values (${input.adminEmail ?? "unknown"}, ${input.action}, ${input.targetUserId ?? null},
            ${input.target ?? null}, ${input.details ? JSON.stringify(input.details) : null}::jsonb)
  `;
}

export async function listAdminEvents(limit = 50): Promise<AdminEvent[]> {
  const rows = await sql()`
    select id::text, admin_email, action, target, details, created_at
    from admin_events order by created_at desc limit ${limit}
  `;
  return rows as AdminEvent[];
}
