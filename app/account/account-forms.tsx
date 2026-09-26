"use client";

import { useActionState } from "react";
import {
  changeEmail,
  deleteAccount,
  type ChangeEmailState,
} from "@/app/account/actions";

const INPUT =
  "rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament";
const BUTTON =
  "self-start rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60";

export function ChangeEmailForm() {
  const [state, action, pending] = useActionState<ChangeEmailState, FormData>(changeEmail, {
    step: "email",
  });

  if (state.step === "done") {
    return (
      <p className="text-sm">
        Your email is now <span className="font-medium">{state.newEmail}</span>. Other sessions
        were signed out.
      </p>
    );
  }

  if (state.step === "code") {
    return (
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="intent" value="verify" />
        <input type="hidden" name="newEmail" value={state.newEmail} />
        <p className="text-sm text-muted">
          We sent a 6-digit code to <span className="text-foreground">{state.newEmail}</span>.
        </p>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
          aria-label="Code"
          className={`${INPUT} max-w-40 font-mono tracking-[0.3em]`}
        />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Checking…" : "Change email"}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="intent" value="send" />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">New email</span>
        <input name="newEmail" type="email" required className={`${INPUT} max-w-sm`} />
      </label>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Sending…" : "Send a code"}
      </button>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<{ error?: string } | undefined, FormData>(
    deleteAccount,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>
          Type <span className="font-mono">{email}</span> to confirm.
        </span>
        <input name="confirm" autoComplete="off" required className={`${INPUT} max-w-sm`} />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete account and everything in it"}
      </button>
    </form>
  );
}
