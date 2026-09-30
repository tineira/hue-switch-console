"use client";

import { useActionState } from "react";
import { replaceInviteAction, type InviteState } from "@/app/admin/actions";

// "New link" for an open invite without an address; the new link shows here once.
export function ReplaceInviteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(replaceInviteAction, undefined);
  if (state?.link) {
    return (
      <input
        readOnly
        value={state.link}
        aria-label="New invite link, shown once"
        onFocus={(event) => event.currentTarget.select()}
        className="w-72 rounded-md border border-line bg-background px-2 py-1 font-mono text-xs"
      />
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded-md border border-line px-2 py-1 text-xs hover:border-filament disabled:opacity-60"
      >
        {pending ? "Creating…" : "New link"}
      </button>
      {state?.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
