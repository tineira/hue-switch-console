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
  "w-full rounded-md border border-line bg-background px-3 py-2 text-sm font-medium hover:border-filament";

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
  const privacy = process.env.PRIVACY_URL;
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
                    Continue with Google
                  </button>
                </form>
              ) : null}
              {github ? (
                <form action={signInWithProvider}>
                  <input type="hidden" name="provider" value="github" />
                  <button type="submit" className={PROVIDER_BUTTON}>
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
