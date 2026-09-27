"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  passwordLogin,
  requestInvite,
  sendCode,
  verifyCode,
  type CodeState,
  type SimpleState,
} from "@/app/login/actions";

const INPUT =
  "rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament";
const BUTTON =
  "rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60";

type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string; size?: string }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile, rendered explicitly once this form is on screen (a widget drawn inside
 * a closed <details> never produces a token). It adds cf-turnstile-response to the form, and
 * resets whenever `resetOn` changes, because a token works only once.
 */
function Turnstile({ siteKey, resetOn }: { siteKey: string | null; resetOn?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      if (cancelled || !ref.current) return;
      // api.js loads after the page; wait for it.
      if (!window.turnstile) {
        timer = setTimeout(draw, 200);
        return;
      }
      widget.current = window.turnstile.render(ref.current, { sitekey: siteKey, size: "flexible" });
    };
    draw();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetOn]);

  if (!siteKey) return null;
  return <div ref={ref} />;
}

function ErrorText({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="text-sm text-danger" role="alert">
      {text}
    </p>
  );
}

export function CodeForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    async (prev, formData) =>
      formData.get("intent") === "verify" ? verifyCode(prev, formData) : sendCode(prev, formData),
    { step: "email" },
  );

  if (state.step === "code") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="verify" />
        <input type="hidden" name="email" value={state.email} />
        <p className="text-sm text-muted">
          If <span className="font-medium text-foreground">{state.email}</span> can sign in, we
          sent it a 6-digit code. It expires in 10 minutes.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            className={`${INPUT} font-mono tracking-[0.3em]`}
          />
        </label>
        <ErrorText text={state.error} />
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Checking…" : "Sign in"}
        </button>
        <a href="/login" className="text-center text-sm text-muted underline-offset-4 hover:underline">
          Use a different email
        </a>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="intent" value="send" />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          className={INPUT}
        />
      </label>
      <Turnstile siteKey={turnstileSiteKey} resetOn={state} />
      <ErrorText text={state.error} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Sending…" : "Email me a code"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SimpleState, FormData>(passwordLogin, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input name="email" type="email" autoComplete="username" required className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={INPUT}
        />
      </label>
      <ErrorText text={state?.error} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function RequestInviteForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(requestInvite, undefined);
  if (state?.done) {
    return <p className="text-sm text-muted">{state.done}</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" required className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Note (optional)</span>
        <textarea
          name="note"
          maxLength={500}
          rows={3}
          placeholder="What will you use it for?"
          className={INPUT}
        />
      </label>
      <Turnstile siteKey={turnstileSiteKey} resetOn={state} />
      <ErrorText text={state?.error} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Sending…" : "Request an invite"}
      </button>
    </form>
  );
}

/** "Request an invite": the form (and its bot check) mounts only once opened. */
export function RequestInvitePanel({
  turnstileSiteKey,
  defaultOpen = false,
}: {
  turnstileSiteKey: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-line p-5 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-left font-medium"
      >
        Sign-up is by invitation for now. {open ? "" : "Request an invite"}
      </button>
      {open ? (
        <div className="mt-4">
          <RequestInviteForm turnstileSiteKey={turnstileSiteKey} />
        </div>
      ) : null}
    </section>
  );
}
