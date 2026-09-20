"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiKeyPublic } from "@/lib/types";

function formatWhen(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function KeysPanel({ initialKeys }: { initialKeys: ApiKeyPublic[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [keys, setKeys] = useState(initialKeys);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

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
    if (
      !window.confirm(
        "Revoke this key? Devices using it will get 401 on poll. Recipes already in NVS keep running on the LAN.",
      )
    ) {
      return;
    }
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

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={createKey}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-cream p-4"
      >
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
            Create one, put it in{" "}
            <code className="font-mono text-xs">config.h</code> as{" "}
            <code className="font-mono text-xs">CONSOLE_TOKEN</code>, then
            register the switch. Several boards can share a key; one key per
            board is easier to revoke.
          </p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-cream">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Prefix</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Last used</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-line">
                  <td className="px-3 py-2">{key.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{key.prefix}…</td>
                  <td className="px-3 py-2 text-muted">
                    {formatWhen(key.created_at)}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {formatWhen(key.last_used_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => revokeKey(key.id)}
                      disabled={revoking === key.id}
                      className="text-sm text-danger hover:underline disabled:opacity-50"
                    >
                      {revoking === key.id ? "Revoking…" : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
