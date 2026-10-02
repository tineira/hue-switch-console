import Link from "next/link";
import { deleteAccountAction, limitsAction, makeCurrentAction } from "@/app/admin/actions";
import { SuspendForm } from "@/app/admin/suspend-form";
import { Shell } from "@/app/shell";
import { LIMIT_KEYS, PAGE_SIZE, adminTabCounts, type AdminAccountRow } from "@/lib/admin";
import { CONSOLE_ACTOR, FIRMWARE_CI_ACTOR, type AdminEvent } from "@/lib/audit";
import { listStoredReleases, type StoredRelease } from "@/lib/firmware";
import type { FirmwareRow } from "@/lib/fleet";
import type { ProductId } from "@/lib/web-setup/products";

// What the admin tabs share (docs/specs/finished/admin-tabs.md).

// Free-tier yardsticks (docs/specs/finished/multi-user-accounts.md §2.11): one board at the
// 900 s idle poll makes about 2,900 calls a month; Vercel Hobby allows 1,000,000; Neon Free 0.5 GB.
export const CALLS_PER_SWITCH_MONTH = 2900;
export const VERCEL_CALLS_MONTH = 1_000_000;
export const NEON_BYTES = 512 * 1024 * 1024;

export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-medium">{value}</span>
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </div>
  );
}

export function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`;
}

export const LIMIT_LABELS: Record<(typeof LIMIT_KEYS)[number], string> = {
  switches: "Switches",
  bridges: "Bridges",
  keys: "API keys",
  snapshotKb: "Snapshot KB",
};

export const SMALL_BUTTON = "rounded-md border border-line px-2 py-1 text-xs hover:border-filament";
export const INPUT = "rounded-md border border-line bg-background px-2 py-1 text-xs";

export function day(value: string | Date | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "—";
}

export const EVENT_LABELS: Record<AdminEvent["action"], string> = {
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
  waitlist_auto_admit: "admitted from the waitlist",
  firmware_upload: "uploaded",
  notice_dismiss: "dismissed the notice about",
};

export const ACTORS: Record<string, string> = {
  [CONSOLE_ACTOR]: "The console",
  [FIRMWARE_CI_ACTOR]: "Firmware CI",
};

export function eventDetails(e: AdminEvent): string {
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
  if (e.action === "firmware_upload") return d.current ? "current, first release" : "waiting";
  return "";
}

// A release kept for its notes only, under the fold of the firmware table.
export function NotesOnlyRow({ release: r }: { release: StoredRelease }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="font-mono text-xs">{r.version}</span>
      <span className="text-xs text-muted">{day(r.createdAt)}</span>
      <span className="ml-auto text-xs text-muted">notes only</span>
    </li>
  );
}

function Count({ value, className = "" }: { value: number | undefined; className?: string }) {
  return value ? <span className={className}>{value}</span> : <span className="text-muted/60">—</span>;
}

// Each release with the switches that run it, across every account. Older rows that still have
// switches stay amber: an old path in the device API goes only once no switch runs an older
// version (AGENTS.md, "Cross-repo changes").
export function FirmwareTable({ product, rows }: { product: ProductId; rows: FirmwareRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-muted">No releases yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted">
        <tr className="align-bottom">
          <th className="py-1 text-left font-medium">Version</th>
          <th className="py-1 pl-2 text-right font-medium">Switches</th>
          <th className="py-1 pl-2 text-right font-medium" title="Not seen for 24 hours, or never">
            Quiet 24 h
          </th>
          <th className="py-1 pl-2 text-right font-medium" title="An update failed in the last 7 days">
            Update failed
          </th>
          <th className="py-1 pl-2">
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(({ version, release: r, count, relation }) => (
          <tr key={version ?? "none"}>
            <td className={`py-1.5 ${relation === "older" && count ? "text-warn" : ""}`}>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="font-mono text-xs">{version ?? "not reported"}</span>
                {r ? <span className="text-xs text-muted">{day(r.createdAt)}</span> : null}
                {r?.waiting ? (
                  <span className="rounded-full bg-warn-soft px-2 py-px text-[11px] font-medium text-warn">
                    waiting
                  </span>
                ) : null}
              </span>
            </td>
            <td className="py-1.5 pl-2 text-right text-xs">
              <Count value={count?.switches} />
            </td>
            <td className="py-1.5 pl-2 text-right text-xs">
              <Count value={count?.quiet} />
            </td>
            <td className="py-1.5 pl-2 text-right text-xs">
              <Count value={count?.otaFailed} className="text-danger" />
            </td>
            <td className="py-1.5 pl-2 text-right text-xs whitespace-nowrap">
              {r?.current ? (
                <span className="font-medium">current</span>
              ) : r?.hasBins ? (
                <form action={makeCurrentAction}>
                  <input type="hidden" name="product" value={product} />
                  <input type="hidden" name="version" value={r.version} />
                  <button className={SMALL_BUTTON}>Make current</button>
                </form>
              ) : (
                <span className="text-muted">{r ? "notes only" : version ? "not uploaded" : ""}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const PANEL_TITLE = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";

// The detail row under an account: suspend, limits and delete side by side. Admin accounts get
// limits only; suspend and delete are refused for them on the server too (admin-tools §2.2).
export function ManagePanel({
  account: a,
  isAdmin,
  isSelf,
  defaults,
}: {
  account: AdminAccountRow;
  isAdmin: boolean;
  isSelf: boolean;
  defaults: Record<(typeof LIMIT_KEYS)[number], number>;
}) {
  return (
    <div className="grid gap-5 rounded-lg border border-line bg-background p-4 md:grid-cols-3">
      {isAdmin ? null : (
        <div className="flex flex-col gap-2">
          <h3 className={PANEL_TITLE}>{a.suspended ? "Suspended" : "Suspend"}</h3>
          <SuspendForm id={a.id} suspended={a.suspended} />
        </div>
      )}
      <form action={limitsAction} className="flex flex-col gap-2 text-xs">
        <h3 className={PANEL_TITLE}>Limits</h3>
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="email" value={a.email} />
        <div className="grid grid-cols-2 gap-2">
          {LIMIT_KEYS.map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span>
                {LIMIT_LABELS[key]}
                {key === "snapshotKb" ? null : <span className="text-muted"> · uses {a[key]}</span>}
              </span>
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
        </div>
        <span className="text-muted">Empty means the console default.</span>
        <button className={`${SMALL_BUTTON} self-start`}>Save limits</button>
      </form>
      {isAdmin ? (
        <div className="flex flex-col gap-2 text-xs md:col-span-2">
          <h3 className={PANEL_TITLE}>Suspend and delete</h3>
          <p className="text-muted">
            {isSelf ? "This is your account, an admin account." : "This is an admin account."} Admin
            accounts can&apos;t be suspended or deleted here. Remove the address from{" "}
            <code>ADMIN_EMAILS</code> first.
          </p>
        </div>
      ) : (
        <form
          action={deleteAccountAction}
          className="flex flex-col gap-2 text-xs md:border-l md:border-line md:pl-5"
        >
          <h3 className={`${PANEL_TITLE} text-danger`}>Delete account</h3>
          <p className="text-muted">
            Removes the account with its switches, Bridges, keys and settings. It can&apos;t be undone.
          </p>
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="email" value={a.email} />
          <input name="confirm" placeholder="Type the email to delete" className={INPUT} />
          <button className="self-start rounded-md border border-danger px-2 py-1 text-xs text-danger">
            Delete account
          </button>
        </form>
      )}
    </div>
  );
}

export function pageNumber(value: string | string[] | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function Pager({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
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


export type AdminTab = "overview" | "accounts" | "firmware" | "settings" | "activity";

/** Releases uploaded with bins and never made current, across both products. */
export async function waitingReleases(): Promise<{ label: string; version: string }[]> {
  const [round, simple] = await Promise.all([listStoredReleases("round"), listStoredReleases("simple")]);
  return [
    ...round.filter((r) => r.waiting).map((r) => ({ label: "Round", version: r.version })),
    ...simple.filter((r) => r.waiting).map((r) => ({ label: "Simple", version: r.version })),
  ];
}

/** The page frame for every admin tab: title, the tab row with counts, then the tab's content. */
export async function AdminFrame({
  email,
  active,
  children,
}: {
  email: string | undefined;
  active: AdminTab;
  children: React.ReactNode;
}) {
  const [counts, waiting] = await Promise.all([adminTabCounts(), waitingReleases()]);
  const tabs: { id: AdminTab; href: string; label: string; badge?: string; warn?: boolean }[] = [
    { id: "overview", href: "/admin", label: "Overview" },
    {
      id: "accounts",
      href: "/admin/accounts",
      label: "Accounts",
      badge: counts.waiting > 0 ? `${counts.accounts} · ${counts.waiting} waiting` : String(counts.accounts),
      warn: counts.waiting > 0,
    },
    {
      id: "firmware",
      href: "/admin/firmware",
      label: "Firmware",
      badge: waiting.length > 0 ? `${waiting.length} waiting` : undefined,
      warn: waiting.length > 0,
    },
    { id: "settings", href: "/admin/settings", label: "Settings" },
    { id: "activity", href: "/admin/activity", label: "Activity" },
  ];
  return (
    <Shell email={email}>
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 border-b border-line pb-2 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === active ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${
                tab.id === active
                  ? "bg-filament-soft font-medium text-filament"
                  : "text-muted hover:bg-cream hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className={`ml-1.5 text-xs ${tab.warn ? "text-warn" : "text-muted"}`}>· {tab.badge}</span>
              ) : null}
            </Link>
          ))}
        </nav>
      </section>
      {children}
    </Shell>
  );
}

export function EventList({ events }: { events: AdminEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted">Nothing yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {events.map((e) => {
        const details = eventDetails(e);
        return (
          <li key={e.id} className="flex flex-wrap items-baseline gap-2 py-1.5">
            <span className="text-xs text-muted">
              {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}
            </span>
            <span>
              {ACTORS[e.admin_email] ?? e.admin_email} {EVENT_LABELS[e.action] ?? e.action}
              {e.target ? <> <span className="font-medium">{e.target}</span></> : null}
              {details ? <span className="text-muted"> ({details})</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const CARD = "flex flex-col gap-3 rounded-xl border border-line bg-cream p-5";
