"use client";

import { useActionState } from "react";
import { createInviteAction, type InviteState } from "@/app/admin/actions";

export function CreateInviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Only for this email (optional)</span>
        <input
          name="email"
          type="email"
          className="max-w-sm rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create invite"}
      </button>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.link ? (
        <div className="flex flex-col gap-1 text-sm">
          <span>Copy this link now; it is shown only once. It works once, for 14 days.</span>
          <input
            readOnly
            value={state.link}
            onFocus={(event) => event.currentTarget.select()}
            className="rounded-md border border-line bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
      ) : null}
    </form>
  );
}
