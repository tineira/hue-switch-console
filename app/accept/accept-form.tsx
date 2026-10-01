"use client";

import { useActionState, useState } from "react";
import { acceptTerms } from "@/app/accept/actions";
import type { TermsDocument } from "@/lib/terms";

const BUTTON =
  "self-start rounded-md bg-filament px-4 py-2 text-sm font-medium text-filament-ink disabled:opacity-60";

export function AcceptForm({
  pending,
  next,
  termsHref,
}: {
  pending: TermsDocument[];
  next: string;
  termsHref: string;
}) {
  const [state, action, busy] = useActionState(acceptTerms, undefined);
  const [ticked, setTicked] = useState<TermsDocument[]>([]);
  const all = pending.every((d) => ticked.includes(d));

  function toggle(d: TermsDocument, on: boolean) {
    setTicked((t) => (on ? [...t, d] : t.filter((x) => x !== d)));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {pending.includes("safety") ? (
        <label className="flex cursor-pointer gap-2.5 text-sm">
          <input
            type="checkbox"
            name="safety"
            checked={ticked.includes("safety")}
            onChange={(e) => toggle("safety", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--filament)]"
          />
          <span>
            I have read the{" "}
            <a href="/safety" target="_blank" className="underline underline-offset-4">
              Safety notice
            </a>
            . I understand the designs are uncertified and unproven, that mains wiring can kill, and that a
            qualified electrician must do any mains work.
          </span>
        </label>
      ) : null}
      {pending.includes("terms") ? (
        <label className="flex cursor-pointer gap-2.5 text-sm">
          <input
            type="checkbox"
            name="terms"
            checked={ticked.includes("terms")}
            onChange={(e) => toggle("terms", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--filament)]"
          />
          <span>
            I agree to the{" "}
            <a href={termsHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Terms of Use
            </a>
            .
          </span>
        </label>
      ) : null}
      {state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={!all || busy} className={BUTTON}>
        Continue
      </button>
    </form>
  );
}
