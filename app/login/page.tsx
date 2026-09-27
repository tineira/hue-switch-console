import { cookies } from "next/headers";
import Script from "next/script";
import { signInWithProvider } from "@/app/login/actions";
import { CodeForm, PasswordForm, RequestInviteForm } from "@/app/login/login-form";
import { ThemePicker } from "@/app/theme-picker";
import {
  githubConfigured,
  googleConfigured,
  isEmailConfigured,
  signupMode,
  turnstileSiteKey,
} from "@/lib/account-config";
import { ensureSeedUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { INVITE_COOKIE } from "@/lib/signup";

export const dynamic = "force-dynamic";

const PROVIDER_BUTTON =
  "flex w-full items-center justify-center gap-2.5 rounded-md border border-line bg-background px-3 py-2 text-sm font-medium hover:border-filament";

// Google's "G" in its brand colours, and the GitHub mark in the text colour (both brands' guidelines).
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function errorText(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "provider_unavailable") return "That sign-in option is not available right now.";
  return "That account couldn't sign in. Sign-up is by invitation for now, or the provider refused the request.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (isDbConfigured()) {
    await ensureSchema();
    await ensureSeedUser();
  }

  const email = isEmailConfigured();
  const google = googleConfigured();
  const github = githubConfigured();
  const mode = signupMode();
  const siteKey = turnstileSiteKey();
  const hasInvite = Boolean((await cookies()).get(INVITE_COOKIE)?.value);
  const error = errorText(typeof params.error === "string" ? params.error : undefined);
  // The console's own /privacy page unless the operator links elsewhere.
  const privacy = process.env.PRIVACY_URL || "/privacy";
  const terms = process.env.TERMS_URL;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      {siteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      ) : null}
      <div className="flex justify-end">
        <ThemePicker />
      </div>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Hue switch console
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted">
          {email
            ? "No password needed. New here? Sign-up works the same way when it is open to you."
            : "Email and password for this console's account."}{" "}
          This sign-in is for people; switches use a device API key.
        </p>
      </header>

      {hasInvite ? (
        <p className="rounded-xl border border-filament bg-filament-soft p-4 text-sm">
          You have an invite. Sign in below with the address it was sent to, and your account is
          created.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-danger p-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!isDbConfigured() ? (
        <section className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
          <p className="font-medium text-foreground">Database is not configured</p>
          <p className="mt-2">
            Set <code className="font-mono text-xs">DATABASE_URL</code> (Neon)
            and <code className="font-mono text-xs">AUTH_SECRET</code>, then
            <code className="font-mono text-xs"> USER_EMAIL</code> and{" "}
            <code className="font-mono text-xs">USER_PASSWORD</code> for the first account.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-cream p-5">
          {google || github ? (
            <div className="flex flex-col gap-2">
              {google ? (
                <form action={signInWithProvider}>
                  <input type="hidden" name="provider" value="google" />
                  <button type="submit" className={PROVIDER_BUTTON}>
                    <GoogleLogo />
                    Continue with Google
                  </button>
                </form>
              ) : null}
              {github ? (
                <form action={signInWithProvider}>
                  <input type="hidden" name="provider" value="github" />
                  <button type="submit" className={PROVIDER_BUTTON}>
                    <GitHubLogo />
                    Continue with GitHub
                  </button>
                </form>
              ) : null}
              <div className="flex items-center gap-3 py-1 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            </div>
          ) : null}
          {email ? <CodeForm turnstileSiteKey={siteKey} /> : <PasswordForm />}
        </div>
      )}

      {isDbConfigured() && mode === "invite" && !hasInvite ? (
        <details className="rounded-xl border border-line p-5 text-sm">
          <summary className="cursor-pointer font-medium">
            Sign-up is by invitation for now. Request an invite
          </summary>
          <div className="mt-4">
            <RequestInviteForm turnstileSiteKey={siteKey} />
          </div>
        </details>
      ) : null}

      {privacy || terms ? (
        <p className="flex justify-center gap-4 text-xs text-muted">
          {privacy ? (
            <a href={privacy} className="underline-offset-4 hover:underline">
              Privacy
            </a>
          ) : null}
          {terms ? (
            <a href={terms} className="underline-offset-4 hover:underline">
              Terms
            </a>
          ) : null}
        </p>
      ) : null}
    </main>
  );
}
