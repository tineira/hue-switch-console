import { ChangeEmailForm, DeleteAccountForm } from "@/app/account/account-forms";
import { signOutEverywhere } from "@/app/account/actions";
import { Shell } from "@/app/shell";
import { isAdminEmail, isEmailConfigured, signInMethodLabels } from "@/lib/account-config";
import { requireSessionUser } from "@/lib/auth";
import { accountLimits } from "@/lib/limits";
import { sql } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const user = await requireSessionUser();
  const [rows, limits, counts] = await Promise.all([
    sql()`select provider_id from accounts where user_id = ${user.id} order by created_at`,
    accountLimits(user.id),
    sql()`select
      (select count(*)::int from switches where user_id = ${user.id}) as switches,
      (select count(*)::int from bridges where user_id = ${user.id}) as bridges,
      (select count(*)::int from device_api_keys where user_id = ${user.id} and revoked_at is null) as keys`,
  ]);
  const methods = signInMethodLabels((rows as { provider_id: string }[]).map((r) => r.provider_id));
  const used = counts[0] as { switches: number; bridges: number; keys: number };

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>. Sign-in
          methods: {methods.join(", ") || "none"}.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Usage</h2>
        <p className="text-sm text-muted">
          {used.switches} of {limits.switches} switches, {used.bridges} of {limits.bridges} Bridges,{" "}
          {used.keys} of {limits.keys} active API keys.
        </p>
      </section>

      {isEmailConfigured() ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
          <h2 className="text-lg font-medium">Change email</h2>
          <ChangeEmailForm />
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Sign out everywhere</h2>
        <p className="text-sm text-muted">Ends every session of this account, including this one.</p>
        <form action={signOutEverywhere}>
          <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-filament">
            Sign out everywhere
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-danger p-5">
        <h2 className="text-lg font-medium">Delete account</h2>
        <p className="text-sm text-muted">
          Deletes your API keys, Bridges, switches, pages and recipes. This can&apos;t be undone.
          Boards on the wall keep their saved recipes but can no longer reach the console.
        </p>
        {isAdminEmail(user.email) ? (
          <p className="text-sm text-muted">
            This is an admin account. Remove the address from <code>ADMIN_EMAILS</code> first.
          </p>
        ) : user.email ? (
          <DeleteAccountForm email={user.email} />
        ) : null}
      </section>
    </Shell>
  );
}
