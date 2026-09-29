import Link from "next/link";
import {
  decideRequestAction,
  deleteAccountAction,
  emailInviteAction,
  limitsAction,
  makeCurrentAction,
  revokeInviteAction,
} from "@/app/admin/actions";
import { CreateInviteForm } from "@/app/admin/create-invite-form";
import { SuspendForm } from "@/app/admin/suspend-form";
import { WaitlistSettingsForm } from "@/app/admin/waitlist-settings-form";
import { Shell } from "@/app/shell";
import {
  defaultLimits,
  emailDailyCap,
  isAdminEmail,
  signInMethodLabels,
  signupMode,
  waitlistEmailsPerDay,
} from "@/lib/account-config";
import { LIMIT_KEYS, listAccounts, PAGE_SIZE, SORTS, type SortKey } from "@/lib/admin";
import { listAdminEvents, type AdminEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { currentSignupMode, currentUserCap, readSettings } from "@/lib/console-settings";
import { emailsSentToday, waitlistEmailsSentToday } from "@/lib/email";
import { listStoredReleases } from "@/lib/firmware";
import { INVITE_STATES, inviteState, listInvites, type InviteState } from "@/lib/signup";
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

const EVENT_LABELS: Record<AdminEvent["action"], string> = {
  suspend: "suspended",
  unsuspend: "lifted the suspension of",
  delete_account: "deleted",
  limits: "set limits for",
  invite_create: "created an invite for",
  invite_email: "emailed an invite to",
  invite_revoke: "revoked the invite for",
  waitlist_admit: "admitted",
  waitlist_remove: "removed from the waitlist",
  settings: "changed the waitlist settings",
  firmware_current: "made current",
};

function eventDetails(e: AdminEvent): string {
  const d = e.details ?? {};
  if (e.action === "suspend") {
    const parts = [d.reason ? `“${d.reason}”` : null, d.until ? `until ${day(String(d.until))}` : null];
    return parts.filter(Boolean).join(", ");
  }
  if (e.action === "limits") {
    const entries = Object.entries(d);
    return entries.length ? entries.map(([k, v]) => `${k} ${v}`).join(", ") : "defaults";
  }
  if (e.action === "settings") return `${d.mode}, cap ${d.cap ?? "none"}`;
  return "";
}

function pageNumber(value: string | string[] | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function Pager({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      {page > 1 ? (
        <Link href={href(page - 1)} className={SMALL_BUTTON}>
          Previous
        </Link>
      ) : null}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={SMALL_BUTTON}>
          Next
        </Link>
      ) : null}
    </div>
  );
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
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = pageNumber(params.page);
  const inviteFilter = (
    typeof params.invites === "string" && (INVITE_STATES as readonly string[]).includes(params.invites)
      ? params.invites
      : "all"
  ) as InviteState;
  const invitePage = pageNumber(params.ipage);

  // Every link keeps the rest of the page's state (search, sort, filters, pages).
  function adminHref(changes: Record<string, string | null>) {
    const next = new URLSearchParams();
    const current: Record<string, string> = {
      q,
      sort,
      dir: desc ? "desc" : "asc",
      filter: dormantOnly ? "dormant" : "",
      page: String(page),
      invites: inviteFilter,
      ipage: String(invitePage),
    };
    for (const [key, value] of Object.entries({ ...current, ...changes })) {
      const isDefault =
        !value ||
        (key === "sort" && value === "created") ||
        (key === "dir" && value === "desc") ||
        (key === "invites" && value === "all") ||
        ((key === "page" || key === "ipage") && value === "1");
      if (!isDefault) next.set(key, value);
    }
    const text = next.toString();
    return text ? `/admin?${text}` : "/admin";
  }

  const settings = await readSettings();
  const [
    accounts,
    requests,
    invites,
    mode,
    cap,
    seats,
    stats,
    problems,
    load,
    sent,
    waitlistSent,
    roundReleases,
    simpleReleases,
    events,
  ] = await Promise.all([
      listAccounts({ q, sort, desc, dormantOnly, page }),
      listPendingEntries(),
      listInvites({ state: inviteFilter, page: invitePage, pageSize: PAGE_SIZE }),
      currentSignupMode(settings),
      currentUserCap(settings),
      seatsUsed(),
      waitlistStats(),
      deliveryProblems(),
      loadStats(),
      emailsSentToday(),
      waitlistEmailsSentToday(),
      listStoredReleases("round"),
      listStoredReleases("simple"),
      listAdminEvents(50),
    ]);
  const waitingReleases = [
    ...roundReleases.filter((r) => r.waiting).map((r) => ({ label: "Round", version: r.version })),
    ...simpleReleases.filter((r) => r.waiting).map((r) => ({ label: "Simple", version: r.version })),
  ];
  const waitlistOn = mode === "invite" || mode === "waitlist";
  const envMode = signupMode();
  const defaults = defaultLimits();

  function sortHref(key: SortKey) {
    const dir = key === sort && desc ? "asc" : "desc";
    return adminHref({ sort: key, dir, page: null });
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
          {accounts.total} {accounts.total === 1 ? "account" : "accounts"}. This page shows counts only, never recipes or topology.
        </p>
        {waitingReleases.length > 0 ? (
          <p className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">
            <span className="font-medium text-warn">Firmware waiting:</span>{" "}
            {waitingReleases.map((r) => `${r.label} ${r.version}`).join(", ")}. Nothing
            changes for anyone until you make it current under{" "}
            <a href="#firmware" className="underline">
              Firmware
            </a>
            .
          </p>
        ) : null}
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
                    <input type="hidden" name="email" value={r.email} />
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
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {INVITE_STATES.map((state) => (
            <Link
              key={state}
              href={adminHref({ invites: state, ipage: null })}
              className={`${SMALL_BUTTON} ${state === inviteFilter ? "border-filament" : ""}`}
            >
              {state}
            </Link>
          ))}
          <span className="text-muted">
            {invites.total} {invites.total === 1 ? "invite" : "invites"}
          </span>
        </div>
        {invites.rows.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {invites.rows.map((i) => {
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
        <Pager page={invitePage} total={invites.total} href={(n) => adminHref({ ipage: String(n) })} />
      </section>

      <section id="firmware" className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Firmware</h2>
        <p className="text-sm text-muted">
          What <code>/setup</code> installs and Switches offers over Wi-Fi. A new upload from
          firmware CI <span className="font-medium text-foreground">waits here</span> until you
          make it current; until then it is not installed, offered or shown on{" "}
          <code>/changelog</code>. Make an older release current to roll back. Releases without
          bins keep their notes only.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {(
            [
              ["round", "Round", roundReleases],
              ["simple", "Simple", simpleReleases],
            ] as const
          ).map(([product, label, releases]) => (
            <div key={product} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">{label}</h3>
              <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto text-sm">
                {releases.map((r) => (
                  <li key={r.version} className="flex items-center gap-3 py-1.5">
                    <span className="font-mono text-xs">{r.version}</span>
                    <span className="text-xs text-muted">{day(r.createdAt)}</span>
                    {r.waiting ? (
                      <span className="rounded-full bg-warn-soft px-2 py-px text-[11px] font-medium text-warn">
                        waiting
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs">
                      {r.current ? (
                        <span className="font-medium">current</span>
                      ) : r.hasBins ? (
                        <form action={makeCurrentAction}>
                          <input type="hidden" name="product" value={product} />
                          <input type="hidden" name="version" value={r.version} />
                          <button className={SMALL_BUTTON}>Make current</button>
                        </form>
                      ) : (
                        <span className="text-muted">notes only</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-medium">Accounts</h2>
          <form action="/admin" className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by email"
              className={INPUT}
            />
            {sort !== "created" ? <input type="hidden" name="sort" value={sort} /> : null}
            {!desc ? <input type="hidden" name="dir" value="asc" /> : null}
            {dormantOnly ? <input type="hidden" name="filter" value="dormant" /> : null}
            <button className={SMALL_BUTTON}>Search</button>
          </form>
          <Link
            href={adminHref({ filter: dormantOnly ? null : "dormant", page: null })}
            className={SMALL_BUTTON}
          >
            {dormantOnly ? "Show all" : `Dormant (${accounts.dormant})`}
          </Link>
          <span className="text-xs text-muted">
            Dormant: no switch and no sign-in for 60 days. Nothing is deleted automatically.
          </span>
        </div>
        {q ? (
          <p className="text-xs text-muted">
            {accounts.matching} {accounts.matching === 1 ? "match" : "matches"} for “{q}”.{" "}
            <Link href={adminHref({ q: null, page: null })} className="underline">
              Clear
            </Link>
          </p>
        ) : null}
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
              {accounts.rows.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-2 py-2">{a.email}</td>
                  <td className="px-2 py-2 text-muted">{signInMethodLabels(a.methods).join(", ") || "none"}</td>
                  <td className="px-2 py-2">{day(a.created_at)}</td>
                  <td className="px-2 py-2">{day(a.last_login_at)}</td>
                  <td className="px-2 py-2">{a.switches}</td>
                  <td className="px-2 py-2">{a.bridges}</td>
                  <td className="px-2 py-2">{day(a.last_board_seen)}</td>
                  <td className="px-2 py-2">
                    {a.suspended ? (
                      <span className="text-danger">suspended</span>
                    ) : a.dormant ? (
                      "dormant"
                    ) : (
                      "active"
                    )}
                    {a.suspended && (a.ban_reason || a.ban_expires) ? (
                      <p className="text-xs text-muted">
                        {[a.ban_reason, a.ban_expires ? `until ${day(a.ban_expires)}` : null]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    ) : null}
                    {a.refused ? (
                      <p className="text-xs text-danger">
                        Register refused {day(a.refused.at)}: {a.refused.reason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    {a.id === admin.id ? (
                      <span className="text-xs text-muted">you</span>
                    ) : isAdminEmail(a.email) ? (
                      <span className="text-xs text-muted">admin</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-xs">Manage</summary>
                        <div className="mt-2 flex w-64 flex-col gap-3">
                          <SuspendForm id={a.id} suspended={a.suspended} />
                          <form action={limitsAction} className="grid grid-cols-2 gap-1 text-xs">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="email" value={a.email} />
                            {LIMIT_KEYS.map((key) => (
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
                            <span className="col-span-2 text-muted">Empty means the console default.</span>
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
        <Pager page={page} total={accounts.matching} href={(n) => adminHref({ page: String(n) })} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Admin activity</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {events.map((e) => {
              const details = eventDetails(e);
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2 py-1.5">
                  <span className="text-xs text-muted">{new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}</span>
                  <span>
                    {e.admin_email} {EVENT_LABELS[e.action] ?? e.action}
                    {e.target ? <> <span className="font-medium">{e.target}</span></> : null}
                    {details ? <span className="text-muted"> ({details})</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">The newest 50. Kept for a year.</p>
      </section>
    </Shell>
  );
}
