// Env-driven settings for accounts (docs/specs/multi-user-accounts.md §2.10).

export type SignupMode = "closed" | "invite" | "open";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function signupMode(): SignupMode {
  // Without email there is no way to verify a new address.
  if (!isEmailConfigured()) return "closed";
  const raw = process.env.SIGNUP_MODE?.trim().toLowerCase();
  if (raw === "invite" || raw === "open") return raw;
  return "closed";
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function turnstileSiteKey(): string | null {
  const site = process.env.TURNSTILE_SITE_KEY;
  return site && process.env.TURNSTILE_SECRET_KEY ? site : null;
}

export function seedEmail(): string | null {
  return process.env.USER_EMAIL?.trim().toLowerCase() || null;
}

export function adminEmails(): string[] {
  const list = (process.env.ADMIN_EMAILS ?? "")
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
  return process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || null;
}
