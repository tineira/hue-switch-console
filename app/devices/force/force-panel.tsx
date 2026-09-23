"use client";

import { useState } from "react";
import { ChipMismatchError, flashProduct } from "@/lib/web-setup/flash";
import { loadManifestStatus } from "@/lib/web-setup/manifest";
import { PRODUCTS, type ProductId } from "@/lib/web-setup/products";
import { requestSerialPort } from "@/lib/web-setup/serial";

const CHOICES: ProductId[] = ["simple", "round"];

function errorMessage(err: unknown): string {
  if (err instanceof ChipMismatchError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong";
}

export function ForcePanel() {
  const [busy, setBusy] = useState<ProductId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function force(id: ProductId) {
    const product = PRODUCTS[id];
    const ok = window.confirm(
      `This writes the ${product.board} firmware (${product.label}). Hold BOOT, then click OK. Chrome will ask for the USB port. If the chip is not a ${product.chipFamily}, the write is aborted.`,
    );
    if (!ok) return;

    setBusy(id);
    setError(null);
    setDone(null);
    setPercent(null);
    setStatus("Opening the port…");
    try {
      const port = await requestSerialPort();
      const manifest = await loadManifestStatus(product.manifestPath, product.chipFamily);
      if (manifest.missing.length > 0) {
        throw new Error(`Firmware file missing: ${manifest.missing.join(", ")}`);
      }
      const detected = await flashProduct({
        port,
        product,
        status: manifest,
        unidentified: true,
        onProgress: ({ message, percent: next }) => {
          setStatus(message);
          setPercent(next);
        },
      });
      setDone(`${product.board} · ${manifest.version} · chip ${detected || "unnamed"}`);
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
      setPercent(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map((id) => {
          const product = PRODUCTS[id];
          const running = busy === id;
          return (
            <button
              key={id}
              type="button"
              disabled={busy !== null}
              onClick={() => void force(id)}
              className="rounded-xl border border-line bg-cream px-4 py-4 text-left disabled:opacity-60"
            >
              <span className="block text-sm font-medium">{product.chipFamily}</span>
              <span className="mt-1 block text-sm text-muted">
                {running ? "Flashing…" : `${product.board} · ${product.label}`}
              </span>
            </button>
          );
        })}
      </div>

      {status ? (
        <p className="text-sm text-muted" role="status">
          {status}
          {percent !== null ? ` ${percent}%` : ""}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm" role="status">
          Flash finished. Press RESET on the board. {done}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
