import { redirect } from "next/navigation";
import { AcceptForm } from "@/app/accept/accept-form";
import { SafetyPoints } from "@/app/safety/safety-points";
import { SignOutButton } from "@/app/sign-out-button";
import { ThemePicker } from "@/app/theme-picker";
import { getSessionUser } from "@/lib/auth";
import { loginHref, safeReturnPath } from "@/lib/return-path";
import { operatorTermsUrl } from "@/lib/terms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Before you continue",
  robots: { index: false },
};

// Every signed-in page sends here until the current Safety notice and Terms are accepted
// (docs/specs/terms-and-safety.md §2.4). A plain frame: the app's navigation would only lead back.
export default async function AcceptPage({ searchParams }: PageProps<"/accept">) {
  const params = await searchParams;
  const next = safeReturnPath(typeof params.next === "string" ? params.next : null);
  const user = await getSessionUser({ allowPending: true });
  if (!user) redirect(loginHref(next === "/" ? null : `/accept?next=${encodeURIComponent(next)}`));
  if (user.pending.length === 0) redirect(next);

  const changed = user.pending.length < 2 && user.pending.includes("terms");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Hue switch console</p>
        <ThemePicker />
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Before you continue</h1>
        <p className="text-sm text-muted">
          {changed
            ? "The Terms of Use have changed. Read and accept them to keep using the console."
            : "This project involves building electrical devices. Read this, then accept to use the console. Switches you already installed keep working either way."}
        </p>
      </header>
      {user.pending.includes("safety") ? (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/50 bg-danger-soft p-4">
          <p className="font-semibold text-danger">Safety notice</p>
          <SafetyPoints />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-cream p-5">
        <AcceptForm pending={user.pending} next={next} termsHref={operatorTermsUrl() ?? "/terms"} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Signed in as {user.email}.</span>
        <SignOutButton />
      </div>
    </main>
  );
}
