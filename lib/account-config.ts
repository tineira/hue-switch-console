// Env-driven settings for accounts (docs/specs/finished/multi-user-accounts.md §2.10).

/**
 * An env var with surrounding whitespace removed, or undefined when empty. Values pasted or
 * piped into a dashboard often end with a newline, which breaks keys sent to other services
 * (a Turnstile site key with "
" never renders).
 */
export function envValue(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export type SignupMode = "closed" | "invite" | "open";

export function isEmailConfigured(): boolean {
  return Boolean(envValue("RESEND_API_KEY") && envValue("EMAIL_FROM"));
}

export function signupMode(): SignupMode {
  // Without email there is no way to verify a new address.
  if (!isEmailConfigured()) return "closed";
  const raw = envValue("SIGNUP_MODE")?.toLowerCase();
  if (raw === "invite" || raw === "open") return raw;
  return "closed";
}

export function googleConfigured(): boolean {
  return Boolean(envValue("GOOGLE_CLIENT_ID") && envValue("GOOGLE_CLIENT_SECRET"));
}

export function githubConfigured(): boolean {
  return Boolean(envValue("GITHUB_CLIENT_ID") && envValue("GITHUB_CLIENT_SECRET"));
}

export function turnstileSiteKey(): string | null {
  const site = envValue("TURNSTILE_SITE_KEY");
  return site && envValue("TURNSTILE_SECRET_KEY") ? site : null;
}

export function seedEmail(): string | null {
  return envValue("USER_EMAIL")?.toLowerCase() || null;
}

export function adminEmails(): string[] {
  const list = (envValue("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 0) return list;
  const seed = seedEmail();
  return seed ? [seed] : [];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export type AccountLimits = {
  switches: number;
  bridges: number;
  keys: number;
  snapshotKb: number;
};

export function defaultLimits(): AccountLimits {
  return {
    switches: envInt("LIMIT_SWITCHES", 25),
    bridges: envInt("LIMIT_BRIDGES", 5),
    keys: envInt("LIMIT_KEYS", 25),
    snapshotKb: envInt("LIMIT_SNAPSHOT_KB", 512),
  };
}

/** Defaults with the account's `users.limits` overrides applied. */
export function effectiveLimits(overrides: unknown): AccountLimits {
  const limits = defaultLimits();
  if (!overrides || typeof overrides !== "object") return limits;
  for (const key of Object.keys(limits) as (keyof AccountLimits)[]) {
    const value = Number((overrides as Record<string, unknown>)[key]);
    if (Number.isFinite(value) && value > 0) limits[key] = Math.floor(value);
  }
  return limits;
}

export function emailDailyCap(): number {
  return envInt("EMAIL_DAILY_CAP", 90);
}

export function publicUrl(): string | null {
  return envValue("BETTER_AUTH_URL")?.replace(/\/$/, "") || null;
}
