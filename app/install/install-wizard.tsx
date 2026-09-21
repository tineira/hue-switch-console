"use client";

import { webSerialBlockedReason } from "@/lib/web-setup/browser";
import { ChipMismatchError, flashProduct } from "@/lib/web-setup/flash";
import { mintUsbDeviceToken, writeConsoleNvs } from "@/lib/web-setup/hueset";
import {
  provisionWifi,
  scanNetworks,
  type WifiNetwork,
} from "@/lib/web-setup/improv";
import {
  loadManifestStatus,
  type ManifestStatus,
} from "@/lib/web-setup/manifest";
import {
  PRODUCT_CONSOLE_URL,
  PRODUCTS,
  usbKeyName,
  type ProductId,
  type ProductSpec,
} from "@/lib/web-setup/products";
import { BytePort, requestSerialPort } from "@/lib/web-setup/serial";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Step = "pick" | "flash" | "reconnect" | "wifi" | "token" | "done";

function errorMessage(err: unknown): string {
  if (err instanceof ChipMismatchError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong";
}

function subscribeNoop() {
  return () => {};
}

export function InstallWizard() {
  const blocked = useSyncExternalStore(
    subscribeNoop,
    webSerialBlockedReason,
    () => null,
  );
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [manifest, setManifest] = useState<ManifestStatus | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashOk, setFlashOk] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [scanHint, setScanHint] = useState<string | null>(null);
  const sessionRef = useRef<BytePort | null>(null);
  const loadGen = useRef(0);

  const product: ProductSpec | null = productId ? PRODUCTS[productId] : null;
  const binsReady = Boolean(manifest && manifest.missing.length === 0);

  useEffect(() => {
    return () => {
      void sessionRef.current?.close();
    };
  }, []);

  async function pickProduct(id: ProductId) {
    const spec = PRODUCTS[id];
    const gen = ++loadGen.current;
    setProductId(id);
    setError(null);
    if (step !== "pick" && step !== "done") {
      await closeSession();
      setStep("pick");
      setStatus(null);
      setPercent(null);
      setFlashOk(false);
      setNetworks([]);
      setSsid("");
      setPassword("");
      setScanHint(null);
    }
    setLoadingManifest(true);
    setManifest(null);
    setManifestError(null);
    try {
      const loaded = await loadManifestStatus(spec.manifestPath, spec.chipFamily);
      if (gen !== loadGen.current) return;
      setManifest(loaded);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setManifestError(errorMessage(err));
    } finally {
      if (gen === loadGen.current) setLoadingManifest(false);
    }
  }

  async function closeSession() {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await session.close();
  }

  async function runFlash() {
    if (!product || !manifest || blocked) return;
    setBusy(true);
    setError(null);
    setStatus("Select the USB serial port");
    setPercent(null);
    setStep("flash");
    try {
      const port = await requestSerialPort();
      await flashProduct({
        port,
        product,
        status: manifest,
        onProgress: ({ message, percent: next }) => {
          setStatus(message);
          setPercent(next);
        },
      });
      setFlashOk(true);
      setStep("reconnect");
      setStatus(null);
      setPercent(null);
    } catch (err) {
      setError(errorMessage(err));
      setStep("pick");
    } finally {
      setBusy(false);
    }
  }

  async function openCdc(): Promise<BytePort> {
    await closeSession();
    const port = await requestSerialPort();
    const session = new BytePort(port);
    await session.open(115200);
    sessionRef.current = session;
    return session;
  }

  async function runReconnect(next: "wifi") {
    if (blocked) return;
    setBusy(true);
    setError(null);
    setStatus("Opening serial port…");
    try {
      await openCdc();
      setStep(next);
      setStatus(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function startConfigureWifi() {
    if (!product || blocked) return;
    setError(null);
    setScanHint(null);
    setNetworks([]);
    void closeSession();
    setStep("reconnect");
  }

  async function runScan() {
    const session = sessionRef.current;
    if (!session) {
      setError("Select the serial port first");
      return;
    }
    setBusy(true);
    setScanHint(null);
    setError(null);
    setStatus("Scanning Wi-Fi…");
    try {
      const found = await scanNetworks(session);
      setNetworks(found);
      if (found.length === 0) {
        setScanHint("No networks reported. Enter the SSID manually.");
      }
      setStatus(null);
    } catch (err) {
      setScanHint(errorMessage(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function runProvision() {
    const session = sessionRef.current;
    if (!session) {
      setError("Select the serial port first");
      return;
    }
    const network = ssid.trim();
    if (!network) {
      setError("Enter a Wi-Fi network name");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Connecting to Wi-Fi…");
    try {
      await provisionWifi(session, network, password);
      setStep("token");
      setStatus("Saving device token…");
      const token = await mintUsbDeviceToken(usbKeyName());
      try {
        await writeConsoleNvs(session, token, PRODUCT_CONSOLE_URL);
      } catch (err) {
        throw new Error(
          `${errorMessage(err)} The key was created; revoke it on API keys if this device did not save it.`,
        );
      }
      await closeSession();
      setStep("done");
      setStatus(null);
    } catch (err) {
      setError(errorMessage(err));
      setStep("wifi");
    } finally {
      setBusy(false);
    }
  }

  function resetWizard() {
    void closeSession();
    setStep("pick");
    setError(null);
    setStatus(null);
    setPercent(null);
    setFlashOk(false);
    setNetworks([]);
    setSsid("");
    setPassword("");
    setScanHint(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {blocked ? (
        <p
          className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn"
          role="status"
        >
          {blocked}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
        <h2 className="text-sm font-medium">Product</h2>
        <p className="text-sm text-muted">
          Choose Round or Simple before opening the USB port. The wizard
          detects the chip and will not flash the other product.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PRODUCTS) as ProductId[]).map((id) => {
            const item = PRODUCTS[id];
            const selected = productId === id;
            return (
              <button
                key={id}
                type="button"
                disabled={busy && step !== "pick"}
                onClick={() => void pickProduct(id)}
                className={`rounded-lg border px-4 py-3 text-left ${
                  selected
                    ? "border-filament bg-filament-soft"
                    : "border-line bg-background hover:border-filament/50"
                }`}
              >
                <p className="font-medium">{item.label}</p>
                <p className="mt-1 text-xs text-muted">
                  {item.board} · {item.chipFamily}
                </p>
              </button>
            );
          })}
        </div>

        {product ? (
          <div className="flex flex-col gap-1 text-sm">
            {loadingManifest ? (
              <p className="text-muted">Loading firmware manifest…</p>
            ) : manifestError ? (
              <p className="text-danger" role="alert">
                {manifestError}
              </p>
            ) : manifest ? (
              <>
                <p>
                  Firmware{" "}
                  <span className="font-mono text-xs">{manifest.version}</span>
                  <span className="text-muted"> · {manifest.manifest.name}</span>
                </p>
                {manifest.missing.length > 0 ? (
                  <p className="text-warn">
                    Firmware images are not published yet (
                    {manifest.missing.join(", ")}). Flash is unavailable until
                    CI exports bootloader, partitions, boot_app0, and app.
                    Configure Wi-Fi still works on a board that already has
                    firmware.
                  </p>
                ) : (
                  <p className="text-muted">
                    Images ready. Flash does not erase NVS.
                  </p>
                )}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={Boolean(blocked) || !product || !binsReady || busy}
            onClick={() => void runFlash()}
            className="rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
          >
            {busy && step === "flash" ? "Flashing…" : "Install"}
          </button>
          <button
            type="button"
            disabled={Boolean(blocked) || !product || busy}
            onClick={() => void startConfigureWifi()}
            className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            Configure Wi-Fi
          </button>
        </div>
      </section>

      {step === "flash" ? (
        <section className="rounded-xl border border-line bg-cream p-4 text-sm">
          <p className="font-medium">{status ?? "Flashing…"}</p>
          {percent != null ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-filament"
                style={{ width: `${percent}%` }}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "reconnect" ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
          <h2 className="text-sm font-medium">Reconnect USB</h2>
          <p className="text-sm text-muted">
            Hold BOOT if this is the first flash. After reset the COM port may
            change from ROM to CDC — select it again.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runReconnect("wifi")}
            className="w-fit rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
          >
            {busy ? "Opening…" : "Select serial port"}
          </button>
        </section>
      ) : null}

      {step === "wifi" || step === "token" ? (
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-cream p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Wi-Fi (2.4 GHz)</h2>
            <p className="text-sm text-muted">
              Scan or type the network. Arduino remembers the STA credentials.
              The device token is written next and is not shown.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runScan()}
              className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
            >
              {busy && status?.startsWith("Scanning") ? "Scanning…" : "Scan"}
            </button>
          </div>
          {scanHint ? <p className="text-sm text-muted">{scanHint}</p> : null}
          {networks.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {networks.map((network) => (
                <li key={network.ssid}>
                  <button
                    type="button"
                    onClick={() => setSsid(network.ssid)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      ssid === network.ssid
                        ? "border-filament bg-filament-soft"
                        : "border-line bg-background"
                    }`}
                  >
                    <span className="font-medium">{network.ssid}</span>
                    <span className="ml-2 text-xs text-muted">
                      {network.rssi} dBm
                      {network.auth && network.auth !== "NO"
                        ? ` · ${network.auth}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Network name</span>
              <input
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
                autoComplete="off"
                className="rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                className="rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !ssid.trim()}
            onClick={() => void runProvision()}
            className="w-fit rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
          >
            {busy && (step === "token" || status?.startsWith("Connecting"))
              ? "Saving…"
              : "Save Wi-Fi and token"}
          </button>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="rounded-xl border border-ok/40 bg-ok-soft p-4 text-sm text-ok">
          <p className="font-medium text-foreground">
            Wi-Fi saved. Press the Hue Bridge button, then hold BOOT 3s if it
            asks.
          </p>
          <p className="mt-2 text-muted">
            The switch will register after Hue pairing. It will not appear in
            the list from this screen.
          </p>
          <button
            type="button"
            onClick={resetWizard}
            className="mt-3 rounded-md border border-line bg-cream px-3 py-1.5 text-sm text-foreground"
          >
            Install another
          </button>
        </section>
      ) : null}

      {status && step !== "flash" && step !== "done" ? (
        <p className="text-sm text-muted">{status}</p>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {flashOk && step === "wifi" && error ? (
        <p className="text-sm text-muted">
          Flash succeeded. Use Configure Wi-Fi if you need to pick the COM port
          again without reflashing.
        </p>
      ) : null}
    </div>
  );
}
