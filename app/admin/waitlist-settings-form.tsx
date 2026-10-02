"use client";

import { useActionState, useState, type FormEvent } from "react";
import { waitlistSettingsAction, type WaitlistSettingsState } from "@/app/admin/actions";
import type { SignupMode } from "@/lib/account-config";

const INPUT =
  "rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament";
const PRIMARY =
  "rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60";

const OPTIONS: { value: SignupMode; label: string }[] = [
  { value: "waitlist", label: "Waitlist: admit automatically up to the cap" },
  { value: "invite", label: "Invite: you approve each person" },
  { value: "open", label: "Open: anyone can sign up" },
  { value: "closed", label: "Closed: no new accounts" },
];

// What switching to these two changes, shown before it is saved.
const CONFIRM: Partial<Record<SignupMode, string>> = {
  open:
    "Anyone can create an account with Google, GitHub or an emailed code, with no invite. The seat cap stops limiting sign-ups, and the home page shows Create an account instead of the waitlist form. People already waiting get no email.",
  closed:
    "Nobody new can get an account. The waitlist form leaves the home page and unused invites stop working. Existing accounts keep signing in, and people already waiting stay in the queue.",
};

/** Sign-up mode and seat cap (docs/specs/finished/waitlist.md §2.7). Saving admits people if seats opened. */
export function WaitlistSettingsForm({ mode, cap }: { mode: SignupMode; cap: number | null }) {
  const [state, action, pending] = useActionState<WaitlistSettingsState, FormData>(
    waitlistSettingsAction,
    undefined,
  );
  const [selected, setSelected] = useState<SignupMode>(mode);
  const [confirming, setConfirming] = useState(false);
  // Only a switch to open or closed asks first; once saved, `mode` catches up and this clears.
  const warning = selected !== mode ? CONFIRM[selected] : undefined;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (warning && submitter?.name !== "confirm") {
      event.preventDefault();
      setConfirming(true);
    }
  };

  return (
    <form action={action} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mode</span>
        <select
          name="mode"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value as SignupMode);
            setConfirming(false);
          }}
          className={INPUT}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
      {confirming && warning ? (
        <div className="flex w-full flex-col gap-3 rounded-lg border border-filament bg-filament-soft p-4 text-sm">
          <p>
            <span className="font-medium">Switch sign-up to {selected}?</span> {warning}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="confirm" value={selected} disabled={pending} className={PRIMARY}>
              {pending ? "Saving…" : `Switch to ${selected}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-line bg-background px-3 py-2 text-sm font-medium hover:border-filament"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Save"}
        </button>
      )}
      <p className="w-full text-xs text-muted">The seat cap only applies in waitlist mode.</p>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.saved ? (
        <p className="w-full text-sm text-muted">
          Saved.{mode === "waitlist" ? " People who now fit were sent invites, within today's email budget." : null}
        </p>
      ) : null}
    </form>
  );
}
