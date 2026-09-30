import { signupMode, userCapFromEnv, type SignupMode } from "@/lib/account-config";
import { isDbConfigured } from "@/lib/env";
import { sql } from "@/lib/sql";

// Settings the admin changes in /admin without a redeploy (docs/specs/finished/waitlist.md §2.2).
// Env gives the defaults; a saved value wins. Only `invite` and `waitlist` can be chosen here:
// `closed` and `open` stay env-only.

export type ConsoleSettings = {
  signupMode: "invite" | "waitlist" | null;
  userCap: number | null;
  capAlertSent: number | null;
  joinsTotal: number;
  /** When the admin last dismissed each kind of Overview notice. */
  noticesSeen: Partial<Record<NoticeKind, string>>;
};

/** Overview notices an admin can dismiss until something newer happens (docs/specs/finished/admin-tabs.md). */
export const NOTICE_KINDS = ["bounces", "refused"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

const EMPTY: ConsoleSettings = {
  signupMode: null,
  userCap: null,
  capAlertSent: null,
  joinsTotal: 0,
  noticesSeen: {},
};

export async function readSettings(): Promise<ConsoleSettings> {
  if (!isDbConfigured()) return EMPTY;
  try {
    const rows = await sql()`
      select signup_mode, user_cap, cap_alert_sent, joins_total, notices_seen from console_settings where id
    `;
    const row = rows[0];
    if (!row) return EMPTY;
    return {
      signupMode: row.signup_mode ?? null,
      userCap: row.user_cap ?? null,
      capAlertSent: row.cap_alert_sent ?? null,
      joinsTotal: Number(row.joins_total ?? 0),
      noticesSeen: (row.notices_seen as ConsoleSettings["noticesSeen"]) ?? {},
    };
  } catch {
    // Table not created yet (schema runs on first sign-in page or API call).
    return EMPTY;
  }
}

/** The sign-up mode in effect: env, with the admin's `invite`/`waitlist` choice applied. */
export async function currentSignupMode(settings?: ConsoleSettings): Promise<SignupMode> {
  const env = signupMode();
  if (env !== "invite" && env !== "waitlist") return env;
  return (settings ?? (await readSettings())).signupMode ?? env;
}

/** The seat cap in effect, or null for no cap. */
export async function currentUserCap(settings?: ConsoleSettings): Promise<number | null> {
  const saved = (settings ?? (await readSettings())).userCap;
  return saved ?? userCapFromEnv();
}

export async function saveSettings(input: { signupMode?: "invite" | "waitlist"; userCap?: number | null }) {
  const current = await readSettings();
  const mode = input.signupMode ?? current.signupMode;
  const cap = input.userCap === undefined ? current.userCap : input.userCap;
  // A new cap starts its 80% / 100% alerts over (§2.7).
  const capChanged = cap !== current.userCap;
  await sql()`
    insert into console_settings (id, signup_mode, user_cap, cap_alert_sent, updated_at)
    values (true, ${mode}, ${cap}, null, now())
    on conflict (id) do update set
      signup_mode = excluded.signup_mode,
      user_cap = excluded.user_cap,
      cap_alert_sent = case when ${capChanged} then null else console_settings.cap_alert_sent end,
      updated_at = now()
  `;
}

export async function markCapAlertSent(threshold: number) {
  await sql()`
    insert into console_settings (id, cap_alert_sent) values (true, ${threshold})
    on conflict (id) do update set cap_alert_sent = ${threshold}, updated_at = now()
  `;
}

export async function countJoin() {
  await sql()`
    insert into console_settings (id, joins_total) values (true, 1)
    on conflict (id) do update set joins_total = console_settings.joins_total + 1
  `;
}

/** Hides a kind of Overview notice until something newer than now happens. */
export async function dismissNotice(kind: NoticeKind) {
  const seen = JSON.stringify({ [kind]: new Date().toISOString() });
  await sql()`
    insert into console_settings (id, notices_seen) values (true, ${seen}::jsonb)
    on conflict (id) do update set notices_seen = console_settings.notices_seen || ${seen}::jsonb
  `;
}
