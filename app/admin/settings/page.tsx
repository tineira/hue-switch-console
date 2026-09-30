import { AdminFrame, CARD, LIMIT_LABELS, Stat } from "@/app/admin/parts";
import { WaitlistSettingsForm } from "@/app/admin/waitlist-settings-form";
import { defaultLimits, emailDailyCap, signupMode, waitlistEmailsPerDay } from "@/lib/account-config";
import { LIMIT_KEYS } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { currentSignupMode, currentUserCap, readSettings } from "@/lib/console-settings";
import { waitlistStats } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings · Admin",
};

// What an admin sets rarely, and the numbers behind it (docs/specs/finished/admin-tabs.md §2).
export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const settings = await readSettings();
  const [mode, cap, stats] = await Promise.all([
    currentSignupMode(settings),
    currentUserCap(settings),
    waitlistStats(),
  ]);
  const envMode = signupMode();
  const defaults = defaultLimits();

  return (
    <AdminFrame email={admin.email} active="settings">
      <section className={CARD}>
        <h2 className="text-lg font-medium">Sign-up</h2>
        {envMode === "invite" || envMode === "waitlist" ? (
          <WaitlistSettingsForm mode={mode === "waitlist" ? "waitlist" : "invite"} cap={cap} />
        ) : (
          <p className="text-sm text-muted">
            <code>SIGNUP_MODE</code> is <code>{envMode}</code>. Set it to <code>waitlist</code> or{" "}
            <code>invite</code> to use the waitlist.
          </p>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 border-t border-line pt-4">
          <Stat label="Joined, last 7 days" value={stats.joined7} note={`${stats.joined30} in 30 days`} />
          <Stat label="Joined, total" value={Math.max(stats.joinsTotal, stats.joined30)} note="Since the waitlist started" />
          <Stat
            label="Last 90 days"
            value={`${stats.admitted} admitted`}
            note={`${stats.left} left, ${stats.expired} expired, ${stats.dismissed} removed`}
          />
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-medium">Account limits</h2>
        <p className="text-sm text-muted">
          The defaults for every account, from the environment (<code>LIMIT_SWITCHES</code>,{" "}
          <code>LIMIT_BRIDGES</code>, <code>LIMIT_KEYS</code>, <code>LIMIT_SNAPSHOT_KB</code>). Change one
          account&apos;s limits under Accounts, Manage.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
          {LIMIT_KEYS.map((key) => (
            <Stat key={key} label={LIMIT_LABELS[key]} value={defaults[key]} />
          ))}
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-medium">Email budgets</h2>
        <p className="text-sm text-muted">
          How many emails the console sends in 24 hours, from the environment (<code>EMAIL_DAILY_CAP</code>,{" "}
          <code>WAITLIST_EMAILS_PER_DAY</code>). Waitlist invites and confirmations count toward both.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
          <Stat label="All emails a day" value={emailDailyCap()} />
          <Stat label="Waitlist emails a day" value={waitlistEmailsPerDay()} />
        </div>
      </section>
    </AdminFrame>
  );
}
