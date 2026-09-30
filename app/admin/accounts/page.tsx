import Link from "next/link";
import { Fragment } from "react";
import { decideRequestAction, emailInviteAction, revokeInviteAction } from "@/app/admin/actions";
import { CreateInviteForm } from "@/app/admin/create-invite-form";
import {
  AdminFrame,
  CARD,
  INPUT,
  ManagePanel,
  Pager,
  SMALL_BUTTON,
  day,
  pageNumber,
} from "@/app/admin/parts";
import { ReplaceInviteForm } from "@/app/admin/replace-invite-form";
import { defaultLimits, isAdminEmail, signInMethodLabels } from "@/lib/account-config";
import { listAccounts, PAGE_SIZE, SORTS, type SortKey } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { currentSignupMode } from "@/lib/console-settings";
import { INVITE_STATES, inviteState, listInvites, type InviteState } from "@/lib/signup";
import { listPendingEntries } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accounts · Admin",
};

const BASE = "/admin/accounts";

// Who gets in and who is in: the waitlist queue, the accounts, and invites
// (docs/specs/admin-tabs.md §2).
export default async function AdminAccountsPage({
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
      : "open"
  ) as InviteState;
  const invitePage = pageNumber(params.ipage);
  // The account whose Manage row is open (an id from the list, never trusted beyond matching it).
  const manage = typeof params.manage === "string" ? params.manage.slice(0, 64) : "";

  // Every link keeps the rest of the page's state (search, sort, filters, pages, open row).
  function href(changes: Record<string, string | null>) {
    const next = new URLSearchParams();
    const current: Record<string, string> = {
      q,
      sort,
      dir: desc ? "desc" : "asc",
      filter: dormantOnly ? "dormant" : "",
      page: String(page),
      invites: inviteFilter,
      ipage: String(invitePage),
      manage,
    };
    for (const [key, value] of Object.entries({ ...current, ...changes })) {
      const isDefault =
        !value ||
        (key === "sort" && value === "created") ||
        (key === "dir" && value === "desc") ||
        (key === "invites" && value === "open") ||
        ((key === "page" || key === "ipage") && value === "1");
      if (!isDefault) next.set(key, value);
    }
    const text = next.toString();
    return text ? `${BASE}?${text}` : BASE;
  }

  const [accounts, requests, invites, mode] = await Promise.all([
    listAccounts({ q, sort, desc, dormantOnly, page }),
    listPendingEntries(),
    listInvites({ state: inviteFilter, page: invitePage, pageSize: PAGE_SIZE }),
    currentSignupMode(),
  ]);
  const waitlistOn = mode === "invite" || mode === "waitlist";
  const defaults = defaultLimits();

  const header = (key: SortKey, label: string) => (
    <th className="px-2 py-2 text-left font-medium">
      <Link href={href({ sort: key, dir: key === sort && desc ? "asc" : "desc", page: null })} className="hover:underline">
        {label}
        {key === sort ? (desc ? " ↓" : " ↑") : ""}
      </Link>
    </th>
  );

  return (
    <AdminFrame email={admin.email} active="accounts">
      {waitlistOn && requests.length > 0 ? (
        <section id="in-line" className={`${CARD} border-warn/40`}>
          <h2 className="text-lg font-medium">In line ({requests.length}, oldest first)</h2>
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
        </section>
      ) : null}

      <section id="accounts" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-medium">Accounts</h2>
          <form action={BASE} className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search by email" className={INPUT} />
            {sort !== "created" ? <input type="hidden" name="sort" value={sort} /> : null}
            {!desc ? <input type="hidden" name="dir" value="asc" /> : null}
            {dormantOnly ? <input type="hidden" name="filter" value="dormant" /> : null}
            <button className={SMALL_BUTTON}>Search</button>
          </form>
          <Link href={href({ filter: dormantOnly ? null : "dormant", page: null })} className={SMALL_BUTTON}>
            {dormantOnly ? "Show all" : `Dormant (${accounts.dormant})`}
          </Link>
          <span className="text-xs text-muted">
            Dormant: no switch and no sign-in for 60 days. Nothing is deleted automatically.
          </span>
        </div>
        {q ? (
          <p className="text-xs text-muted">
            {accounts.matching} {accounts.matching === 1 ? "match" : "matches"} for “{q}”.{" "}
            <Link href={href({ q: null, page: null })} className="underline">
              Clear
            </Link>
          </p>
        ) : null}
        <div className="relative overflow-x-auto rounded-xl border border-line">
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
              {accounts.rows.map((a) => {
                const open = manage === a.id;
                const isAdmin = isAdminEmail(a.email);
                return (
                  <Fragment key={a.id}>
                    <tr id={`account-${a.id}`} className={`scroll-mt-6 align-top ${open ? "bg-cream" : ""}`}>
                      <td className="px-2 py-2">{a.email}</td>
                      <td className="px-2 py-2 text-muted">{signInMethodLabels(a.methods).join(", ") || "none"}</td>
                      <td className="px-2 py-2">{day(a.created_at)}</td>
                      <td className="px-2 py-2">{day(a.last_login_at)}</td>
                      <td className="px-2 py-2">{a.switches}</td>
                      <td className="px-2 py-2">{a.bridges}</td>
                      <td className="px-2 py-2">{day(a.last_board_seen)}</td>
                      <td className="px-2 py-2">
                        {a.suspended ? <span className="text-danger">suspended</span> : a.dormant ? "dormant" : "active"}
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
                      <td className="whitespace-nowrap px-2 py-2 text-xs">
                        {a.id === admin.id ? <span className="mr-2 text-muted">you</span> : null}
                        {a.id !== admin.id && isAdmin ? <span className="mr-2 text-muted">admin</span> : null}
                        <Link
                          href={`${href({ manage: open ? null : a.id })}#account-${a.id}`}
                          scroll={false}
                          aria-expanded={open}
                          className="hover:underline"
                        >
                          {open ? "▾ Close" : "▸ Manage"}
                        </Link>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-cream">
                        <td colSpan={9} className="px-2 pb-4">
                          <ManagePanel account={a} isAdmin={isAdmin} isSelf={a.id === admin.id} defaults={defaults} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={accounts.matching} href={(n) => href({ page: String(n) })} />
      </section>

      <section id="invites" className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Invites</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {INVITE_STATES.map((state) => (
              <Link
                key={state}
                href={`${href({ invites: state, ipage: null })}#invites`}
                className={`${SMALL_BUTTON} ${state === inviteFilter ? "border-filament" : ""}`}
              >
                {state}
              </Link>
            ))}
            <span className="text-muted">
              {invites.total} {inviteFilter === "all" ? "" : `${inviteFilter} `}
              {invites.total === 1 ? "invite" : "invites"}
            </span>
          </div>
        </div>
        {!waitlistOn ? (
          <p className="text-sm text-muted">
            Invite links only create accounts in the <code>invite</code> and <code>waitlist</code> modes.
          </p>
        ) : null}
        <details className="rounded-lg border border-line bg-background p-3">
          <summary className="cursor-pointer text-sm font-medium">Create invite</summary>
          <div className="mt-3">
            <CreateInviteForm />
          </div>
        </details>
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
                      ) : (
                        <ReplaceInviteForm id={i.id} />
                      )}
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className={SMALL_BUTTON}>Revoke</button>
                      </form>
                    </div>
                  ) : state === "bounced" || state === "complained" ? (
                    <span className="ml-auto text-xs text-muted">
                      {state === "bounced" ? "The address bounced" : "Marked as spam"}; create a new invite if you
                      have a corrected address.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No {inviteFilter === "all" ? "" : `${inviteFilter} `}invites.</p>
        )}
        <Pager page={invitePage} total={invites.total} href={(n) => `${href({ ipage: String(n) })}#invites`} />
      </section>
    </AdminFrame>
  );
}
