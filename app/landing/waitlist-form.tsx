"use client";

import { useActionState, type MouseEvent } from "react";
import { joinWaitlistAction, type SimpleState } from "@/app/login/actions";
import { Turnstile, useTurnstileOnDemand } from "@/app/login/login-form";

const FORM_ID = "waitlist";
const EMAIL_ID = "waitlist-email";

/** "Join the waitlist" in the landing hero; the bot check loads once someone starts filling it in. */
export function LandingWaitlistForm({
  turnstileSiteKey,
  inputClassName,
  buttonClassName,
}: {
  turnstileSiteKey: string | null;
  inputClassName: string;
  buttonClassName: string;
}) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(joinWaitlistAction, undefined);
  const check = useTurnstileOnDemand(turnstileSiteKey, "Join the waitlist");

  if (state?.done) {
    return (
      <p id={FORM_ID} className="text-[15px] font-medium" role="status">
        {state.done}
      </p>
    );
  }

  return (
    <form
      id={FORM_ID}
      action={action}
      {...check.formProps}
      className="flex w-full max-w-[460px] scroll-mt-24 flex-col gap-3"
    >
      <div className="flex flex-wrap gap-2.5">
        <label htmlFor={EMAIL_ID} className="sr-only">
          Email
        </label>
        <input
          id={EMAIL_ID}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className={inputClassName}
        />
        <button type="submit" disabled={pending} className={buttonClassName}>
          {pending ? "Sending…" : "Join the waitlist"}
        </button>
      </div>
      {check.armed ? <Turnstile siteKey={turnstileSiteKey} resetOn={state} /> : null}
      {check.hint || state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {check.hint ?? state?.error}
        </p>
      ) : null}
    </form>
  );
}

/** The closing section's "Join the waitlist": brings the hero form back and puts the cursor in it. */
export function JoinWaitlistLink({ className }: { className: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const input = document.getElementById(EMAIL_ID);
    if (!input) return;
    event.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(FORM_ID)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    input.focus({ preventScroll: true });
  };
  return (
    <a href={`#${FORM_ID}`} onClick={onClick} className={className}>
      Join the waitlist
    </a>
  );
}
