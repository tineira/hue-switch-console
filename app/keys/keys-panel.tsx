"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { agoText, CONSOLE_QUIET_MIN, minutesSince } from "@/lib/ago";
import { formatMac } from "@/lib/mac";
import type { ApiKeyPublic } from "@/lib/types";

function subscribeNoop() {
  return () => {};
}

function formatFull(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function boardName(key: ApiKeyPublic): string | null {
  if (!key.last_switch_mac) return null;
  return key.last_switch_label?.trim() || formatMac(key.last_switch_mac);
}

function revokeWarning(key: ApiKeyPublic): string {
  const board = boardName(key);
  if (!board) {
    return "No board uses this key, so nothing stops working.";
  }
  return `${board} will stop getting config changes until you give it a new key on Setup. What it already saved keeps working on the LAN.`;
}

function LastUsed({ value, mounted }: { value: string | null; mounted: boolean }) {
  const min = mounted ? minutesSince(value) : null;
  const recent = min !== null && min <= CONSOLE_QUIET_MIN;
  const tone = !value || min === null ? "bg-line" : recent ? "bg-ok" : "bg-warn";
  const status = !value ? "Never used" : recent ? "Checking in" : "Quiet";
  const text = !value ? "Never" : min === null ? "" : agoText(min);
  return (
    <span
      className="inline-flex items-center gap-2"
      title={`${status} · ${formatFull(value)}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} aria-hidden />
      <span className="sr-only">{status}.</span>
      <span className="text-muted">{text}</span>
    </span>
  );
}

type RowProps = {
  mounted: boolean;
  confirming: string | null;
  revoking: string | null;
  onAsk: (id: string) => void;
  onCancel: () => void;
  onRevoke: (id: string) => void;
};

function KeyTable({ keys, ...props }: RowProps & { keys: ApiKeyPublic[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-cream">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.08em] text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Board</th>
            <th className="px-3 py-2 font-medium">Key</th>
            <th className="px-3 py-2 font-medium">Last used</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <KeyRow key={key.id} apiKey={key} {...props} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyRow({
  apiKey: key,
  mounted,
  confirming,
  revoking,
  onAsk,
  onCancel,
  onRevoke,
}: RowProps & { apiKey: ApiKeyPublic }) {
  const board = boardName(key);
  const asking = confirming === key.id;
  const busy = revoking === key.id;
  return (
    <>
      <tr className="border-t border-line align-top">
        <td className="px-3 py-2">
          {board && key.last_switch_mac ? (
            <div className="flex flex-col">
              {key.last_switch_bridgeid ? (
                <Link
                  href={`/switches/${key.last_switch_mac}`}
                  className="font-medium hover:text-filament hover:underline"
                >
                  {board}
                </Link>
              ) : (
                <span className="font-medium">{board}</span>
              )}
              {key.last_switch_label?.trim() ? (
                <span className="font-mono text-xs text-muted">
                  {formatMac(key.last_switch_mac)}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted">None</span>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col">
            <span>{key.name}</span>
            <span
              className="text-xs text-muted"
              title={`Created ${formatFull(key.created_at)}`}
            >
              <span className="font-mono">{key.prefix}…</span>
              {mounted ? ` · ${formatDay(key.created_at)}` : null}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <LastUsed value={key.last_used_at} mounted={mounted} />
        </td>
        <td className="px-3 py-2 text-right">
          {asking ? null : (
            <button
              type="button"
              onClick={() => onAsk(key.id)}
              className="text-sm text-danger hover:underline"
            >
              Revoke
            </button>
          )}
        </td>
      </tr>
      {asking ? (
        <tr className="bg-danger-soft">
          <td colSpan={4} className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-56 flex-1 text-sm">
                <span className="font-medium">Revoke {key.name}?</span>{" "}
                {revokeWarning(key)}
              </p>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="rounded-md border border-line bg-cream px-3 py-1.5 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onRevoke(key.id)}
                disabled={busy}
                className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60"
              >
                {busy ? "Revoking…" : "Revoke key"}
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function KeysPanel({ initialKeys }: { initialKeys: ApiKeyPublic[] }) {
  const router = useRouter();
  // Relative times and local dates only after hydration, so server and client agree.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const [name, setName] = useState("");
  const [keys, setKeys] = useState(initialKeys);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const inUse = keys.filter((key) => key.last_switch_mac);
  const unused = keys.filter((key) => !key.last_switch_mac);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json()) as ApiKeyPublic & {
        token?: string;
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        setError(body.details ?? body.error ?? "Could not create key");
        return;
      }
      setKeys((current) => [
        {
          id: body.id,
          name: body.name,
          prefix: body.prefix,
          created_at: body.created_at,
          last_used_at: body.last_used_at,
          last_switch_mac: null,
          last_switch_label: null,
          last_switch_bridgeid: null,
        },
        ...current,
      ]);
      setPlaintext(body.token ?? null);
      setCreatedName(body.name);
      setName("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function revokeKey(id: string) {
    setError(null);
    setRevoking(id);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string; details?: string };
      if (!res.ok) {
        setError(body.details ?? body.error ?? "Could not revoke key");
        return;
      }
      setKeys((current) => current.filter((key) => key.id !== id));
      setConfirming(null);
      router.refresh();
    } finally {
      setRevoking(null);
    }
  }

  async function copyToken() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the token and copy it manually.");
    }
  }

  const rowProps: RowProps = {
    mounted,
    confirming,
    revoking,
    onAsk: setConfirming,
    onCancel: () => setConfirming(null),
    onRevoke: revokeKey,
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {plaintext ? (
        <section className="rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm">
          <p className="font-medium">
            Copy this token now. It will not be shown again.
          </p>
          {createdName ? (
            <p className="mt-1 text-muted">Created for {createdName}.</p>
          ) : null}
          <p className="mt-2 font-mono break-all text-xs">{plaintext}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyToken}
              className="rounded-md border border-line bg-cream px-3 py-1.5 text-sm"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <code className="font-mono text-xs text-muted">
              CONSOLE_TOKEN={plaintext}
            </code>
          </div>
        </section>
      ) : null}

      {keys.length === 0 ? (
        <section className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No keys yet</p>
          <p className="mt-2">
            Set up a switch on{" "}
            <Link href="/setup" className="text-filament hover:underline">
              Setup
            </Link>{" "}
            and it gets a key of its own.
          </p>
        </section>
      ) : null}

      {inUse.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">In use</h2>
          <KeyTable keys={inUse} {...rowProps} />
        </section>
      ) : null}

      {unused.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold">Not in use</h2>
            <p className="text-sm text-muted">
              No board uses these keys. A board set up again on Setup gets a
              new key and leaves the old one here. You can revoke them safely.
            </p>
          </div>
          <KeyTable keys={unused} {...rowProps} />
        </section>
      ) : null}

      <details className="group rounded-xl border border-line bg-cream">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          <span className="inline-block w-4 text-muted transition-transform group-open:rotate-90">
            ›
          </span>
          New key for a developer build
        </summary>
        <form
          onSubmit={createKey}
          className="flex flex-wrap items-end gap-3 border-t border-line p-4"
        >
          <p className="w-full text-sm text-muted">
            Only needed when you flash your own build. Put the key in{" "}
            <code className="font-mono text-xs">config.h</code> as{" "}
            <code className="font-mono text-xs">CONSOLE_TOKEN</code>.
          </p>
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Kitchen XIAO"
              required
              maxLength={80}
              className="rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create key"}
          </button>
        </form>
      </details>
    </div>
  );
}
