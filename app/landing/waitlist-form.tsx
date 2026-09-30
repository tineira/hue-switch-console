"use client";

import Script from "next/script";
import { useActionState, useState, type FormEvent, type MouseEvent } from "react";
import { joinWaitlistAction, type SimpleState } from "@/app/login/actions";
import { Turnstile } from "@/app/login/login-form";

const FORM_ID = "waitlist";
const EMAIL_ID = "waitlist-email";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * "Join the waitlist" in the landing hero. The Turnstile script and widget load only once someone
 * starts filling it in, so visitors who only read the page never load Cloudflare's check.
 */
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
  const [armed, setArmed] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  if (state?.done) {
    return (
      <p id={FORM_ID} className="text-[15px] font-medium" role="status">
        {state.done}
      </p>
    );
  }

  // A submit before the check has produced a token (autofill, then a click) would only fail on
  // the server; show the check instead and let them press again.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!turnstileSiteKey) return;
    if (new FormData(event.currentTarget).get("cf-turnstile-response")) {
      setHint(null);
      return;
    }
    event.preventDefault();
    setArmed(true);
    setHint("Finish the check below, then press Join the waitlist again.");
  };

  return (
    <form
      id={FORM_ID}
      action={action}
      onSubmit={onSubmit}
      onFocus={() => setArmed(true)}
      onPointerDown={() => setArmed(true)}
      className="flex w-full max-w-[460px] scroll-mt-24 flex-col gap-3"
    >
      {armed && turnstileSiteKey ? <Script src={TURNSTILE_SRC} strategy="afterInteractive" /> : null}
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
      {armed ? <Turnstile siteKey={turnstileSiteKey} resetOn={state} /> : null}
      {state?.error || hint ? (
        <p className="text-sm text-danger" role="alert">
          {state?.error ?? hint}
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
