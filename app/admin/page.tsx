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
import { Shell } from "@/app/shell";
import { defaultLimits, signInMethodLabels, signupMode } from "@/lib/account-config";
import { listAccounts, SORTS, type AdminAccountRow, type SortKey } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { listInvites, listPendingInviteRequests, type InviteRow } from "@/lib/signup";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
};

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

  const [accounts, requests, invites] = await Promise.all([
    listAccounts(),
    listPendingInviteRequests(),
    listInvites(),
  ]);
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
          Sign-up mode: <span className="font-medium text-foreground">{signupMode()}</span>.{" "}
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}. This page shows counts only, never recipes or topology.
        </p>
      </section>

      {requests.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
          <h2 className="text-lg font-medium">Invite requests ({requests.length})</h2>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.email}</p>
                  {r.note ? <p className="text-muted">{r.note}</p> : null}
                  <p className="text-xs text-muted">{day(r.created_at)}</p>
                </div>
                <form action={decideRequestAction} className="flex gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button name="decision" value="approve" className={SMALL_BUTTON}>
                    Approve and email invite
                  </button>
                  <button name="decision" value="dismiss" className={SMALL_BUTTON}>
                    Dismiss
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-5">
        <h2 className="text-lg font-medium">Invites</h2>
        {signupMode() !== "invite" ? (
          <p className="text-sm text-muted">
            Invite links only create accounts while SIGNUP_MODE is <code>invite</code>.
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
