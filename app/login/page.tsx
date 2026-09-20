import { LoginForm } from "@/app/login/login-form";
import { ensureSeedUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isDbConfigured()) {
    await ensureSchema();
    await ensureSeedUser();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Hue switch console
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted">
          Email and password for the seeded account. Public signup is disabled.
          This login is for people — switches use a device API key.
        </p>
      </header>

      {!isDbConfigured() ? (
        <section className="rounded-xl border border-dashed border-line bg-cream p-4 text-sm text-muted">
          <p className="font-medium text-foreground">Database is not configured</p>
          <p className="mt-2">
            Set <code className="font-mono text-xs">DATABASE_URL</code> (Neon)
            and <code className="font-mono text-xs">AUTH_SECRET</code>, apply{" "}
            <code className="font-mono text-xs">db/schema.sql</code>, then seed
            the first user.
          </p>
        </section>
      ) : (
        <div className="rounded-xl border border-line bg-cream p-5">
          <LoginForm />
        </div>
      )}
    </main>
  );
}
