import Link from "next/link";
import {
  decideRequestAction,
  deleteAccountAction,
  emailInviteAction,
  limitsAction,
  revokeInviteAction,
  suspendAction,
} from "@/app/admin/actions";
import { CreateInviteForm } from "@/app/admin/create-invite-form";
import { WaitlistSettingsForm } from "@/app/admin/waitlist-settings-form";
import { Shell } from "@/app/shell";
import {
  defaultLimits,
  emailDailyCap,
  signInMethodLabels,
  signupMode,
  waitlistEmailsPerDay,
} from "@/lib/account-config";
import { listAccounts, SORTS, type AdminAccountRow, type SortKey } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { currentSignupMode, currentUserCap, readSettings } from "@/lib/console-settings";
import { emailsSentToday, waitlistEmailsSentToday } from "@/lib/email";
import { listInvites, type InviteRow } from "@/lib/signup";
import {
  deliveryProblems,
  listPendingEntries,
  loadStats,
  seatsUsed,
  waitlistStats,
} from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
};

// Free-tier yardsticks (docs/specs/finished/multi-user-accounts.md §2.11): one board at the
// 900 s idle poll makes about 2,900 calls a month; Vercel Hobby allows 1,000,000; Neon Free 0.5 GB.
const CALLS_PER_SWITCH_MONTH = 2900;
const VERCEL_CALLS_MONTH = 1_000_000;
const NEON_BYTES = 512 * 1024 * 1024;

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-medium">{value}</span>
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </div>
  );
}

function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`;
}

const SMALL_BUTTON = "rounded-md border border-line px-2 py-1 text-xs hover:border-filament";
const INPUT = "rounded-md border border-line bg-background px-2 py-1 text-xs";

function day(value: string | Date | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "—";
}

function inviteState(i: InviteRow): "used" | "revoked" | "expired" | "open" {
  if (i.used_at) return "used";
  if (i.revoked_at) return "revoked";
  return new Date(i.expires_at).getTime() < Date.now() ? "expired" : "open";
}

function sortRows(rows: AdminAccountRow[], key: SortKey, desc: boolean) {
  const field = SORTS[key] as keyof AdminAccountRow;
  return [...rows].sort((a, b) => {
    const x = a[field] ?? "";
    const y = b[field] ?? "";
    const order = x < y ? -1 : x > y ? 1 : 0;
    return desc ? -order : order;
  });
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const sort = (
    typeof params.sort === "string" && params.sort in SORTS ? params.sort : "created"
  ) as SortKey;
  const desc = params.dir !== "asc";
  const dormantOnly = params.filter === "dormant";

  const settings = await readSettings();
  const [accounts, requests, invites, mode, cap, seats, stats, problems, load, sent, waitlistSent] =
    await Promise.all([
      listAccounts(),
      listPendingEntries(),
      listInvites(),
      currentSignupMode(settings),
      currentUserCap(settings),
      seatsUsed(),
      waitlistStats(),
      deliveryProblems(),
      loadStats(),
      emailsSentToday(),
      waitlistEmailsSentToday(),
    ]);
  const waitlistOn = mode === "invite" || mode === "waitlist";
  const envMode = signupMode();
  const shown = sortRows(dormantOnly ? accounts.filter((a) => a.dormant) : accounts, sort, desc);
  const defaults = defaultLimits();
  const dormantCount = accounts.filter((a) => a.dormant).length;

  function sortHref(key: SortKey) {
    const dir = key === sort && desc ? "asc" : "desc";
    const q = new URLSearchParams({ sort: key, dir });
    if (dormantOnly) q.set("filter", "dormant");
    return `/admin?${q}`;
  }

  const header = (key: SortKey, label: string) => (
    <th className="px-2 py-2 text-left font-medium">
      <Link href={sortHref(key)} className="hover:underline">
        {label}
        {key === sort ? (desc ? " ↓" : " ↑") : ""}
      </Link>
    </th>
  );

  return (
    <Shell email={admin.email} wide>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted">
          Sign-up mode: <span className="font-medium text-foreground">{mode}</span>.{" "}
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}. This page shows counts only, never recipes or topology.
        </p>
      </section>

      <section className="flex flex-col gap-5 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Waitlist</h2>
        {envMode === "invite" || envMode === "waitlist" ? (
          <WaitlistSettingsForm mode={mode === "waitlist" ? "waitlist" : "invite"} cap={cap} />
        ) : (
          <p className="text-sm text-muted">
            SIGNUP_MODE is <code>{envMode}</code>. Set it to <code>waitlist</code> or{" "}
            <code>invite</code> to use the waitlist.
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
          <Stat
            label="Seats used"
            value={cap === null ? seats.total : `${seats.total} / ${cap}`}
            note={`${seats.accounts} accounts, ${seats.invites} unused invites${
              cap !== null && seats.total > cap ? " (over cap)" : ""
            }`}
          />
          <Stat label="Waiting" value={stats.pending} />
          <Stat label="Joined, last 7 days" value={stats.joined7} note={`${stats.joined30} in 30 days`} />
          <Stat label="Joined, total" value={stats.joinsTotal} note="Since the waitlist started" />
          <Stat
            label="Last 90 days"
            value={`${stats.admitted} admitted`}
            note={`${stats.left} left, ${stats.expired} expired, ${stats.dismissed} removed`}
          />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
          <Stat label="Emails, last 24 h" value={`${sent} / ${emailDailyCap()}`} />
          <Stat label="Waitlist emails, last 24 h" value={`${waitlistSent} / ${waitlistEmailsPerDay()}`} />
          <Stat
            label="Bounces and complaints, 30 days"
            value={problems.reduce((sum, p) => sum + p.n, 0)}
            note={
              problems.length > 0
                ? problems
                    .map((p) => `${p.n} ${p.kind === "email_bounced" ? "bounced" : "complaint"} (${p.tag})`)
                    .join(", ")
                : "None"
            }
          />
          <Stat
            label="Switches"
            value={load.switches}
            note={`About ${percent(load.switches * CALLS_PER_SWITCH_MONTH, VERCEL_CALLS_MONTH)} of Vercel's free calls`}
          />
          <Stat
            label="Database"
            value={`${(load.dbBytes / (1024 * 1024)).toFixed(0)} MB`}
            note={`${percent(load.dbBytes, NEON_BYTES)} of Neon's free 0.5 GB`}
          />
        </div>

        {waitlistOn && requests.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">In line ({requests.length}, oldest first)</h3>
            <ul className="flex flex-col divide-y divide-line text-sm">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.email}</p>
                    <p className="text-xs text-muted">
                      Joined {day(r.created_at)}
                      {r.confirmation_sent_at ? "" : ", no confirmation email"}
                    </p>
                  </div>
                  <form action={decideRequestAction} className="flex gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <button name="decision" value="approve" className={SMALL_BUTTON}>
                      Admit now
                    </button>
                    <button name="decision" value="dismiss" className={SMALL_BUTTON}>
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Invites</h2>
        {!waitlistOn ? (
          <p className="text-sm text-muted">
            Invite links only create accounts in the <code>invite</code> and <code>waitlist</code>{" "}
            modes.
          </p>
        ) : null}
        <CreateInviteForm />
        {invites.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {invites.slice(0, 30).map((i) => {
              const state = inviteState(i);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-mono text-xs">{i.code_prefix}…</span>
                  <span className="text-muted">{i.email ?? "any email"}</span>
                  <span className="text-xs text-muted">
                    {state}, created {day(i.created_at)}
                  </span>
                  {state === "open" ? (
                    <div className="ml-auto flex gap-2">
                      {i.email ? (
                        <form action={emailInviteAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className={SMALL_BUTTON}>Email invite</button>
                        </form>
                      ) : null}
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className={SMALL_BUTTON}>Revoke</button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-medium">Accounts</h2>
          <Link href={dormantOnly ? "/admin" : "/admin?filter=dormant"} className={SMALL_BUTTON}>
            {dormantOnly ? "Show all" : `Dormant (${dormantCount})`}
          </Link>
          <span className="text-xs text-muted">
            Dormant: no switch and no sign-in for 60 days. Nothing is deleted automatically.
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-cream">
              <tr>
                {header("email", "Email")}
                <th className="px-2 py-2 text-left font-medium">Sign-in</th>
                {header("created", "Created")}
                {header("login", "Last sign-in")}
                {header("switches", "Switches")}
                {header("bridges", "Bridges")}
                {header("seen", "Last board seen")}
                {header("status", "Status")}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-2 py-2">{a.email}</td>
                  <td className="px-2 py-2 text-muted">{signInMethodLabels(a.methods).join(", ") || "none"}</td>
                  <td className="px-2 py-2">{day(a.created_at)}</td>
                  <td className="px-2 py-2">{day(a.last_login_at)}</td>
                  <td className="px-2 py-2">{a.switches}</td>
                  <td className="px-2 py-2">{a.bridges}</td>
                  <td className="px-2 py-2">{day(a.last_board_seen)}</td>
                  <td className="px-2 py-2">
                    {a.banned ? (
                      <span className="text-danger">suspended</span>
                    ) : a.dormant ? (
                      "dormant"
                    ) : (
                      "active"
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {a.id === admin.id ? (
                      <span className="text-xs text-muted">you</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-xs">Manage</summary>
                        <div className="mt-2 flex w-64 flex-col gap-3">
                          <form action={suspendAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="banned" value={a.banned ? "false" : "true"} />
                            <button className={SMALL_BUTTON}>{a.banned ? "Unsuspend" : "Suspend"}</button>
                          </form>
                          <form action={limitsAction} className="grid grid-cols-2 gap-1 text-xs">
                            <input type="hidden" name="id" value={a.id} />
                            {(["switches", "bridges", "keys", "snapshotKb"] as const).map((key) => (
                              <label key={key} className="flex flex-col">
                                {key === "snapshotKb" ? "Snapshot KB" : key}
                                <input
                                  name={key}
                                  type="number"
                                  min={1}
                                  defaultValue={a.limits[key] ?? ""}
                                  placeholder={String(defaults[key])}
                                  className={INPUT}
                                />
                              </label>
                            ))}
                            <button className={`${SMALL_BUTTON} col-span-2`}>Save limits</button>
                          </form>
                          <form action={deleteAccountAction} className="flex flex-col gap-1 text-xs">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="email" value={a.email} />
                            <input name="confirm" placeholder="Type the email to delete" className={INPUT} />
                            <button className="rounded-md border border-danger px-2 py-1 text-xs text-danger">
                              Delete account
                            </button>
                          </form>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
