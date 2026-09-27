"use client";

import { useActionState } from "react";
import { waitlistSettingsAction, type WaitlistSettingsState } from "@/app/admin/actions";

const INPUT =
  "rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament";

/** Mode and seat cap (docs/specs/waitlist.md §2.7). Saving admits people if seats opened. */
export function WaitlistSettingsForm({
  mode,
  cap,
}: {
  mode: "invite" | "waitlist";
  cap: number | null;
}) {
  const [state, action, pending] = useActionState<WaitlistSettingsState, FormData>(
    waitlistSettingsAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mode</span>
        <select name="mode" defaultValue={mode} className={INPUT}>
          <option value="waitlist">Waitlist: admit automatically up to the cap</option>
          <option value="invite">Invite: you approve each person</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Seat cap</span>
        <input
          name="cap"
          type="number"
          min={0}
          step={1}
          defaultValue={cap ?? ""}
          placeholder="No cap"
          className={`${INPUT} w-28`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.saved ? (
        <p className="w-full text-sm text-muted">Saved. People who now fit were sent invites, within today&apos;s email budget.</p>
      ) : null}
    </form>
  );
}
