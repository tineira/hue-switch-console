import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import {
  envValue,
  githubConfigured,
  googleConfigured,
  isEmailConfigured,
  publicUrl,
} from "@/lib/account-config";
import { clientIp } from "@/lib/auth-limits";
import { sendChangeEmailCode, sendSignInCode } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { consumeInvite, INVITE_COOKIE, readCookie, signupDecision } from "@/lib/signup";
import { pgConnectionString, pgPool, sql, usesPgDriver } from "@/lib/sql";
import { isSuspended } from "@/lib/suspension";

// Better Auth on the console's own Postgres (docs/specs/finished/multi-user-accounts.md §2.2).
// Tables and columns are snake_case; `users` is the table the rest of the app already uses.

type HookContext = { headers?: Headers; request?: Request } | null | undefined;

function hookHeaders(ctx: HookContext): Headers | null {
  return ctx?.headers ?? ctx?.request?.headers ?? null;
}

function inviteCodeFrom(ctx: HookContext): string | null {
  return readCookie(hookHeaders(ctx)?.get("cookie"), INVITE_COOKIE);
}

const stamps = { createdAt: "created_at", updatedAt: "updated_at" } as const;

/**
 * With DATABASE_DRIVER=pg, Better Auth shares the app's pool (lib/sql.ts). On Neon the app
 * talks HTTP and has no pool, so Better Auth keeps a small one of its own.
 */
function authPool(): Pool {
  const url = process.env.DATABASE_URL ?? "";
  if (usesPgDriver()) return pgPool(url);
  return new Pool({ connectionString: pgConnectionString(url), max: 3 });
}

function createAuth() {
  const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
  if (googleConfigured()) {
    socialProviders.google = {
      clientId: envValue("GOOGLE_CLIENT_ID")!,
      clientSecret: envValue("GOOGLE_CLIENT_SECRET")!,
    };
  }
  if (githubConfigured()) {
    socialProviders.github = {
      clientId: envValue("GITHUB_CLIENT_ID")!,
      clientSecret: envValue("GITHUB_CLIENT_SECRET")!,
    };
  }

  return betterAuth({
    appName: "Hue Switch Console",
    secret: process.env.AUTH_SECRET,
    baseURL: publicUrl() ?? undefined,
    database: authPool(),
    advanced: {
      cookiePrefix: "hsw",
      database: { generateId: "uuid" },
    },
    user: {
      modelName: "users",
      fields: { emailVerified: "email_verified", ...stamps },
      additionalFields: {
        banned: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    session: {
      modelName: "sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        ...stamps,
      },
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    account: {
      modelName: "accounts",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        ...stamps,
      },
      // Google only signs in verified addresses. GitHub links to an existing account only
      // when GitHub says the email is verified; an unverified address could take one over.
      accountLinking: { enabled: true, trustedProviders: ["google"] },
      // Tokens from Google and GitHub are never used; if kept, keep them encrypted.
      encryptOAuthTokens: true,
    },
    verification: {
      modelName: "verifications",
      fields: { expiresAt: "expires_at", ...stamps },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rate_limits",
      fields: { lastRequest: "last_request" },
    },
    // Password sign-in only on consoles without email (self-hosted, §2.2).
    emailAndPassword: {
      enabled: !isEmailConfigured(),
      disableSignUp: true,
      password: {
        hash: async (password) => hashPassword(password),
        verify: async ({ hash, password }) => verifyPassword(password, hash),
      },
    },
    socialProviders,
    databaseHooks: {
      user: {
        create: {
          // The sign-up gate for every method (§2.3). Claims the invite here, so a second
          // sign-up with the same code is refused.
          before: async (user, ctx) => {
            const decision = await signupDecision(user.email, inviteCodeFrom(ctx), {
              claim: true,
            });
            if (!decision.allowed) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-up is by invitation for now.",
              });
            }
          },
          after: async (user, ctx) => {
            await consumeInvite(inviteCodeFrom(ctx), user.id);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            if (await isSuspended(session.userId)) {
              throw new APIError("FORBIDDEN", { message: "This account is suspended." });
            }
          },
          after: async (session) => {
            // ADMIN_EMAILS decides who is an admin (admin-tools §2.2).
            await sql()`update users set last_login_at = now() where id = ${session.userId}`;
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        // Keep only a hash of each code (Better Auth's default is plain text).
        storeOTP: "hashed",
        changeEmail: { enabled: true },
        async sendVerificationOTP({ email, otp, type }, ctx) {
          const headers = hookHeaders(ctx);
          const ip = headers ? clientIp(headers) : null;
          if (type === "sign-in") await sendSignInCode(email, otp, ip);
          else if (type === "change-email") await sendChangeEmailCode(email, otp, ip);
        },
      }),
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof createAuth> | null = null;

/** Built on first use so builds without env vars still work. */
export function auth() {
  if (!instance) instance = createAuth();
  return instance;
}
