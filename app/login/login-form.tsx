"use client";

import { useActionState } from "react";
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

function Turnstile({ siteKey }: { siteKey: string | null }) {
  if (!siteKey) return null;
  // api.js (loaded by the page) renders this and adds cf-turnstile-response to the form.
  return <div className="cf-turnstile" data-sitekey={siteKey} data-size="flexible" />;
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
      <Turnstile siteKey={turnstileSiteKey} />
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
      <Turnstile siteKey={turnstileSiteKey} />
      <ErrorText text={state?.error} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Sending…" : "Request an invite"}
      </button>
    </form>
  );
}
