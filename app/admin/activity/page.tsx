import Link from "next/link";
import { AdminFrame, CARD, EventList, SMALL_BUTTON } from "@/app/admin/parts";
import { CONSOLE_ACTOR, FIRMWARE_CI_ACTOR, listAdminEvents } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity · Admin",
};

const FILTERS = [
  ["all", "Everyone"],
  ["admins", "Admins"],
  ["console", "The console"],
  ["ci", "Firmware CI"],
] as const;

type Filter = (typeof FILTERS)[number][0];

// Who did what, newest first (docs/specs/finished/admin-tabs.md §2).
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const by = (FILTERS.some(([id]) => id === params.by) ? params.by : "all") as Filter;
  // Fetched past 50 so a filter still shows up to 50 of its own.
  const events = (await listAdminEvents(by === "all" ? 50 : 500))
    .filter((e) =>
      by === "all"
        ? true
        : by === "console"
          ? e.admin_email === CONSOLE_ACTOR
          : by === "ci"
            ? e.admin_email === FIRMWARE_CI_ACTOR
            : !e.admin_email.startsWith("system:"),
    )
    .slice(0, 50);

  return (
    <AdminFrame email={admin.email} active="activity">
      <section className={CARD}>
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map(([id, label]) => (
            <Link
              key={id}
              href={id === "all" ? "/admin/activity" : `/admin/activity?by=${id}`}
              className={`${SMALL_BUTTON} ${id === by ? "border-filament" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <EventList events={events} />
        <p className="text-xs text-muted">The newest 50. Kept for a year.</p>
      </section>
    </AdminFrame>
  );
}
