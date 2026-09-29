import { redirect } from "next/navigation";
import { PublicFrame } from "@/app/public-frame";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { findByLeaveToken, leaveWaitlist } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leave the waitlist",
  robots: { index: false },
};

// The link in "You're on the list" (docs/specs/finished/waitlist.md §2.4). Opening it changes nothing,
// because mail scanners open links; the button does.
async function leave(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const left = await leaveWaitlist(token);
  redirect(left ? "/waitlist/leave?done=1" : "/waitlist/leave");
}

export default async function LeaveWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  let entry: { email: string } | null = null;
  if (token && isDbConfigured()) {
    await ensureSchema();
    entry = await findByLeaveToken(token);
  }

  return (
    <PublicFrame>
      <section className="flex max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Leave the waitlist</h1>
        {params.done ? (
          <p className="text-sm text-muted">
            You&apos;re off the waitlist, and we won&apos;t email you about it again.
          </p>
        ) : entry ? (
          <form action={leave} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <p className="text-sm text-muted">
              Take <span className="font-medium text-foreground">{entry.email}</span> off the
              waitlist? You can join again later, at the back of the line.
            </p>
            <button
              type="submit"
              className="self-start rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink"
            >
              Leave the waitlist
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            This link doesn&apos;t match anyone waiting. You may have left already, or already
            received your invite.
          </p>
        )}
      </section>
    </PublicFrame>
  );
}
