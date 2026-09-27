import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import {
  envValue,
  githubConfigured,
  googleConfigured,
  isAdminEmail,
  isEmailConfigured,
  publicUrl,
} from "@/lib/account-config";
import { clientIp } from "@/lib/auth-limits";
import { sendChangeEmailCode, sendSignInCode } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { consumeInvite, INVITE_COOKIE, readCookie, signupDecision } from "@/lib/signup";
import { pgConnectionString, sql } from "@/lib/sql";

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
    database: new Pool({
      connectionString: pgConnectionString(process.env.DATABASE_URL ?? ""),
      max: 3,
    }),
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
          // The sign-up gate for every method (§2.3).
          before: async (user, ctx) => {
            const decision = await signupDecision(user.email, inviteCodeFrom(ctx));
            if (!decision.allowed) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-up is by invitation for now.",
              });
            }
          },
          after: async (user, ctx) => {
            const decision = await signupDecision(user.email, inviteCodeFrom(ctx));
            if (decision.invite) await consumeInvite(decision.invite.id, user.id);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const rows = await sql()`select banned from users where id = ${session.userId}`;
            if ((rows[0] as { banned?: boolean } | undefined)?.banned) {
              throw new APIError("FORBIDDEN", { message: "This account is suspended." });
            }
          },
          after: async (session) => {
            const rows = await sql()`select email from users where id = ${session.userId}`;
            const email = (rows[0] as { email?: string } | undefined)?.email;
            await sql()`
              update users set last_login_at = now(),
                role = ${isAdminEmail(email) ? "admin" : "user"}
              where id = ${session.userId}
            `;
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
