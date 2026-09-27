"use client";

import { useActionState } from "react";
import { suspendAction, type SuspendState } from "@/app/admin/actions";

const SMALL_BUTTON = "rounded-md border border-line px-2 py-1 text-xs hover:border-filament";
const INPUT = "rounded-md border border-line bg-background px-2 py-1 text-xs";

/** Suspend with a reason and an optional end date, or lift the suspension (admin-tools §2.6). */
export function SuspendForm({ id, suspended }: { id: string; suspended: boolean }) {
  const [state, action, pending] = useActionState<SuspendState, FormData>(suspendAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-1 text-xs">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="suspend" value={suspended ? "false" : "true"} />
      {suspended ? null : (
        <>
          <input name="reason" maxLength={200} placeholder="Reason (only admins see it)" className={INPUT} />
          <label className="flex items-center gap-2">
            Until
            <input name="until" type="date" className={INPUT} />
          </label>
          <span className="text-muted">No date: until you lift it.</span>
        </>
      )}
      <button disabled={pending} className={`${SMALL_BUTTON} self-start disabled:opacity-60`}>
        {suspended ? "Unsuspend" : "Suspend"}
      </button>
      {state?.error ? <p className="text-danger">{state.error}</p> : null}
    </form>
  );
}
