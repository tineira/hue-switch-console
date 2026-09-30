import Link from "next/link";
import { redirect } from "next/navigation";
import { dismissNoticeAction } from "@/app/admin/actions";
import {
  AdminFrame,
  CALLS_PER_SWITCH_MONTH,
  CARD,
  EventList,
  NEON_BYTES,
  VERCEL_CALLS_MONTH,
  waitingReleases,
} from "@/app/admin/parts";
import { emailDailyCap } from "@/lib/account-config";
import { fleetCounts, refusedRegisters } from "@/lib/admin";
import { listAdminEvents } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { currentSignupMode, currentUserCap, readSettings, type NoticeKind } from "@/lib/console-settings";
import { emailsSentToday } from "@/lib/email";
import { deliveryProblems, loadStats, seatsUsed, waitlistStats } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
};

// Links from before the tabs (/admin?q=…, ?manage=…, ?invites=…) belong to Accounts now.
const ACCOUNT_PARAMS = ["q", "sort", "dir", "filter", "page", "manage", "invites", "ipage"];

type Attention = {
  text: string;
  href: string;
  action: string;
  tone: "warn" | "info";
  /** A notice that stays true for days: the admin can dismiss it until something newer happens. */
  dismiss?: NoticeKind;
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function Number_({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-cream px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-medium">{value}</span>
      <span className="text-xs text-muted">{note}</span>
    </div>
  );
}

// What needs the admin first, then four numbers, then the latest activity (docs/specs/finished/admin-tabs.md §2).
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (ACCOUNT_PARAMS.some((key) => key in params)) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`/admin/accounts?${query.toString()}`);
  }

  const admin = await requireAdmin();
  const settings = await readSettings();
  const [mode, cap, seats, stats, problems, newProblems, load, sent, fleet, waiting, refused, events] = await Promise.all([
    currentSignupMode(settings),
    currentUserCap(settings),
    seatsUsed(),
    waitlistStats(),
    deliveryProblems(),
    deliveryProblems(settings.noticesSeen.bounces),
    loadStats(),
    emailsSentToday(),
    fleetCounts(),
    waitingReleases(),
    refusedRegisters(settings.noticesSeen.refused),
    listAdminEvents(5),
  ]);

  const emailCap = emailDailyCap();
  const allCounts = [...fleet.round, ...fleet.simple];
  const quiet = allCounts.reduce((sum, c) => sum + c.quiet, 0);
  const otaFailed = allCounts.reduce((sum, c) => sum + c.otaFailed, 0);
  const bounces = problems.reduce((sum, p) => sum + p.n, 0);
  const newBounces = newProblems.reduce((sum, p) => sum + p.n, 0);
  const seatsFull = cap !== null && seats.total >= cap;
  const dbPct = pct(load.dbBytes, NEON_BYTES);
  const callsPct = pct(load.switches * CALLS_PER_SWITCH_MONTH, VERCEL_CALLS_MONTH);

  const attention: Attention[] = [];
  for (const r of waiting) {
    attention.push({
      text: `${r.label} ${r.version} is waiting to go live`,
      href: "/admin/firmware",
      action: "Review",
      tone: "warn",
    });
  }
  if (mode === "waitlist" || mode === "invite") {
    if (stats.pending > 0) {
      attention.push({
        text: `${stats.pending} ${stats.pending === 1 ? "person is" : "people are"} waiting${
          seatsFull ? ", and every seat is taken" : ""
        }`,
        href: "/admin/accounts#in-line",
        action: seatsFull ? "Admit or raise the cap" : "See who",
        tone: "warn",
      });
    } else if (cap !== null && seats.total >= Math.ceil(cap * 0.8)) {
      attention.push({
        text: `${seats.total} of ${cap} seats are used`,
        href: "/admin/settings",
        action: "Raise the cap",
        tone: "warn",
      });
    }
  }
  if (otaFailed > 0) {
    attention.push({
      text: `${otaFailed} ${otaFailed === 1 ? "switch" : "switches"} failed an update in the last 7 days`,
      href: "/admin/firmware",
      action: "See which version",
      tone: "warn",
    });
  }
  for (const r of refused) {
    attention.push({
      text: `${r.email}: a board was refused (${r.reason})`,
      href: `/admin/accounts?q=${encodeURIComponent(r.email)}`,
      action: "Open account",
      tone: "warn",
      dismiss: "refused",
    });
  }
  if (sent >= Math.ceil(emailCap * 0.8)) {
    attention.push({
      text: `${sent} of ${emailCap} emails sent in the last 24 hours`,
      href: "/admin/settings",
      action: "See budgets",
      tone: "warn",
    });
  }
  if (newBounces > 0) {
    attention.push({
      text: `${newBounces} ${newBounces === 1 ? "email" : "emails"} bounced or marked as spam ${
        settings.noticesSeen.bounces ? "since you last dismissed this" : "in 30 days"
      } (${newProblems.map((p) => p.tag).join(", ")})`,
      href: "/admin/accounts?invites=all#invites",
      action: "See invites",
      tone: "info",
      dismiss: "bounces",
    });
  }

  return (
    <AdminFrame email={admin.email} active="overview">
      <section className="flex flex-col gap-2" aria-labelledby="needs-you">
        <h2 id="needs-you" className="text-sm font-medium text-muted">
          Needs you
        </h2>
        {attention.some((a) => a.tone === "warn") ? null : (
          <p className="rounded-xl border border-line px-4 py-3 text-sm text-muted">
            Nothing needs you. No release waiting, nobody in line, no failed updates.
          </p>
        )}
        {attention.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li
                key={a.text}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-sm ${
                  a.tone === "warn" ? "border-warn/40 bg-warn-soft" : "border-line"
                }`}
              >
                <span className={`min-w-0 flex-1 ${a.tone === "warn" ? "text-foreground" : "text-muted"}`}>
                  {a.text}
                </span>
                <Link
                  href={a.href}
                  className={`text-xs font-medium hover:underline ${a.tone === "warn" ? "text-warn" : "text-filament"}`}
                >
                  {a.action} →
                </Link>
                {a.dismiss ? (
                  <form action={dismissNoticeAction}>
                    <input type="hidden" name="kind" value={a.dismiss} />
                    <button
                      className="text-xs text-muted hover:text-foreground hover:underline"
                      title="Hide this until something new happens"
                    >
                      Dismiss
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Key numbers">
        <Number_
          label="Accounts"
          value={cap === null ? seats.accounts : `${seats.total} / ${cap}`}
          note={`${stats.pending} waiting · ${seats.invites} unused ${seats.invites === 1 ? "invite" : "invites"}`}
        />
        <Number_ label="Switches" value={load.switches} note={`${quiet} quiet for 24 h`} />
        <Number_
          label="Emails today"
          value={`${sent} / ${emailCap}`}
          note={`${bounces} ${bounces === 1 ? "bounce" : "bounces"} in 30 days`}
        />
        <Number_
          label="Free tier used"
          value={`${Math.max(dbPct, callsPct)}%`}
          note={`Database ${(load.dbBytes / (1024 * 1024)).toFixed(0)} MB (${dbPct}%) · calls ${callsPct}%`}
        />
      </section>

      <section className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Recent activity</h2>
          <Link href="/admin/activity" className="text-sm text-filament hover:underline">
            All activity
          </Link>
        </div>
        <EventList events={events} />
      </section>
    </AdminFrame>
  );
}
