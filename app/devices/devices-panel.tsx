"use client";

import Link from "next/link";
import { firmwareChangelogHref } from "@/lib/changelog-href";
import { formatMac } from "@/lib/mac";
import { webSerialBlockedReason } from "@/lib/web-setup/browser";
import {
  classifyImprov,
  compareVersions,
  decideActions,
  flashProductFor,
  identifyUsb,
  learnedChip,
  sketchTitle,
  provisioningDone,
  type BoardChoice,
  type Huesta,
  type ImprovSeen,
  type UsbIdentity,
} from "@/lib/web-setup/devices";
import { ChipMismatchError, flashProduct } from "@/lib/web-setup/flash";
import { hueClear, hueGet, hueGetSettled, huePair } from "@/lib/web-setup/huecmd";
import { mintUsbDeviceToken, writeConsoleNvs } from "@/lib/web-setup/hueset";
import {
  PING_MISS_COPY,
  provisionWifi,
  requestDeviceInfo,
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
import { BytePort, requestSerialPort, sleep } from "@/lib/web-setup/serial";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const PAIR_CONFIRM =
  "This forgets the current Hue link and starts pairing again.";
const PAIR_PROMPT = "Press the button on the Hue Bridge.";
const CLEAR_CONFIRM =
  "This forgets Wi-Fi, the console token, the Hue link, and saved recipes or pages. The firmware stays.";

type ConsoleRecord = {
  lastSeenAt: string | null;
  firmware: string | null;
};

type Detected = {
  usb: UsbIdentity;
  improv: ImprovSeen | null;
  huesta: Huesta | null;
  consoleRecord: ConsoleRecord | null;
  consoleError: boolean;
  boardChoice: BoardChoice | null;
  manifest: ManifestStatus | null;
  manifestError: string | null;
  manifestLoading: boolean;
  cdc: boolean;
};

type Panel = "none" | "wifi" | "flash" | "after-flash";

function FirmwareVersion({
  productId,
  version,
}: {
  productId: ProductId | null;
  version: string;
}) {
  const href = firmwareChangelogHref(productId, version);
  if (!href) return <span className="font-mono text-xs">{version}</span>;
  return (
    <Link
      href={href}
      className="font-mono text-xs underline decoration-line underline-offset-2 hover:text-filament"
    >
      {version}
    </Link>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ChipMismatchError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong";
}

function subscribeNoop() {
  return () => {};
}

function formatSeen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function reportedVersion(detected: Detected): string {
  if (detected.huesta?.ver) return detected.huesta.ver;
  return detected.improv?.version ?? "";
}

function mismatchText(record: ConsoleRecord, reported: string): string | null {
  if (!record.firmware || !reported) return null;
  if (record.firmware.trim() === reported.trim()) return null;
  return `Console firmware ${record.firmware} does not match this USB report (${reported}).`;
}

async function lookupConsole(
  mac: string,
): Promise<ConsoleRecord | "missing" | "error"> {
  try {
    const res = await fetch(`/api/switches/${encodeURIComponent(mac)}`, {
      cache: "no-store",
    });
    if (!res.ok) return "error";
    const body = (await res.json()) as {
      found?: unknown;
      last_seen_at?: unknown;
      firmware?: unknown;
    };
    if (body.found !== true) return "missing";
    return {
      lastSeenAt: typeof body.last_seen_at === "string" ? body.last_seen_at : null,
      firmware: typeof body.firmware === "string" ? body.firmware : null,
    };
  } catch {
    return "error";
  }
}

async function readConsole(
  card: Huesta | null,
): Promise<{ record: ConsoleRecord | null; error: boolean }> {
  if (!card?.mac) return { record: null, error: false };
  const looked = await lookupConsole(card.mac);
  if (looked === "error") return { record: null, error: true };
  if (looked === "missing") return { record: null, error: false };
  return { record: looked, error: false };
}

function Field({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "break-all text-sm"}>
        {href ? (
          <Link
            href={href}
            className="underline decoration-line underline-offset-2 hover:text-filament"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}


export function DevicesPanel() {
  const blocked = useSyncExternalStore(
    subscribeNoop,
    webSerialBlockedReason,
    () => null,
  );
  const [detected, setDetected] = useState<Detected | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [usbLog, setUsbLog] = useState<string[]>([]);
  const sessionRef = useRef<BytePort | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const detectGen = useRef(0);
  const manifestGen = useRef(0);

  function appendUsbLog(line: string) {
    setUsbLog((prev) => [...prev.slice(-80), line]);
  }

  useEffect(() => {
    return () => {
      void sessionRef.current?.close();
    };
  }, []);

  async function closeSession() {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    portRef.current = session.port;
    await session.close();
  }

  async function loadManifestFor(spec: ProductSpec, gen: number) {
    try {
      const loaded = await loadManifestStatus(spec.manifestPath, spec.chipFamily);
      if (gen !== manifestGen.current) return;
      setDetected((prev) =>
        prev
          ? { ...prev, manifest: loaded, manifestError: null, manifestLoading: false }
          : prev,
      );
    } catch (err) {
      if (gen !== manifestGen.current) return;
      setDetected((prev) =>
        prev
          ? {
              ...prev,
              manifest: null,
              manifestError: errorMessage(err),
              manifestLoading: false,
            }
          : prev,
      );
    }
  }

  async function detect() {
    if (blocked) return;
    const gen = ++detectGen.current;
    setBusy(true);
    setError(null);
    setStatus("Select the USB serial port");
    setPanel("none");
    try {
      const port = await requestSerialPort();
      if (gen !== detectGen.current) return;
      await closeSession();
      if (gen !== detectGen.current) return;
      portRef.current = port;
      setNetworks([]);
      setSsid("");
      setPassword("");
      setScanHint(null);
      setUsbLog([]);
      const info = port.getInfo();
      const usb = identifyUsb(info.usbVendorId, info.usbProductId);
      const knownBoard = usb.kind === "c6" || usb.kind === "s3";
      const probe = knownBoard || usb.kind === "bootloader";
      setDetected({
        usb,
        improv: null,
        huesta: null,
        consoleRecord: null,
        consoleError: false,
        boardChoice: null,
        manifest: null,
        manifestError: null,
        manifestLoading: knownBoard,
        cdc: false,
      });
      if (knownBoard) {
        const spec = PRODUCTS[usb.kind === "c6" ? "simple" : "round"];
        const mgen = ++manifestGen.current;
        void loadManifestFor(spec, mgen);
      }
      if (probe) {
        setStatus("Reading the device…");
        const session = new BytePort(port, appendUsbLog);
        sessionRef.current = session;
        appendUsbLog("— open CDC —");
        try {
          await session.open(115200);
        } catch (err) {
          sessionRef.current = null;
          try {
            await session.close();
          } catch {
            /* open failed before streams were usable */
          }
          if (usb.kind === "bootloader") {
            setError(errorMessage(err));
            if (gen === detectGen.current) setStatus(null);
            return;
          }
          throw err;
        }
        if (gen !== detectGen.current) return;
        portRef.current = session.port;
        appendUsbLog("— improv info —");
        const deviceInfo = await requestDeviceInfo(session, appendUsbLog);
        if (gen !== detectGen.current) return;
        const improv = deviceInfo ? classifyImprov(deviceInfo) : null;
        appendUsbLog("— HUEGET —");
        const huesta = improv
          ? await hueGetSettled(session, appendUsbLog)
          : await hueGet(session, 6000, appendUsbLog);
        if (gen !== detectGen.current) return;
        const looked = await readConsole(huesta);
        if (gen !== detectGen.current) return;
        const chip = learnedChip(improv, huesta);
        setDetected((prev) =>
          prev
            ? {
                ...prev,
                improv,
                huesta,
                consoleRecord: looked.record,
                consoleError: looked.error,
                cdc: true,
                manifestLoading:
                  usb.kind === "bootloader" && chip ? true : prev.manifestLoading,
              }
            : prev,
        );
        if (usb.kind === "bootloader" && chip) {
          const spec = PRODUCTS[chip === "c6" ? "simple" : "round"];
          const mgen = ++manifestGen.current;
          void loadManifestFor(spec, mgen);
        }
      }
      if (gen === detectGen.current) setStatus(null);
    } catch (err) {
      if (gen !== detectGen.current) return;
      setError(errorMessage(err));
      setStatus(null);
    } finally {
      if (gen === detectGen.current) setBusy(false);
    }
  }


  async function chooseBoard(choice: BoardChoice) {
    const spec = PRODUCTS[choice === "c6" ? "simple" : "round"];
    const mgen = ++manifestGen.current;
    setDetected((prev) =>
      prev
        ? {
            ...prev,
            boardChoice: choice,
            manifest: null,
            manifestError: null,
            manifestLoading: true,
          }
        : prev,
    );
    await loadManifestFor(spec, mgen);
  }

  async function reread(session: BytePort) {
    const hadCard = Boolean(detected?.huesta);
    const card = await hueGetSettled(session, appendUsbLog);
    if (!card) {
      if (hadCard) setError("The stored card could not be reread.");
      return;
    }
    const looked = await readConsole(card);
    setDetected((prev) =>
      prev
        ? {
            ...prev,
            huesta: card,
            consoleRecord: looked.record,
            consoleError: looked.error,
          }
        : prev,
    );
  }

  async function runFlash() {
    if (!detected || !product || !detected.manifest || blocked) return;
    if (detected.manifest.missing.length > 0) return;
    const manifest = detected.manifest;
    setBusy(true);
    setError(null);
    setPanel("flash");
    setPercent(null);
    setStatus("Flashing…");
    try {
      await closeSession();
      setDetected((prev) => (prev ? { ...prev, cdc: false } : prev));
      const port = portRef.current;
      if (!port) throw new Error("Detect the device again.");
      if (detected.usb.kind === "other") {
        const board = product.board;
        const ok = window.confirm(
          `This writes the ${board} firmware. This port did not identify the chip. If this board is not a ${board}, it can fail to start.`,
        );
        if (!ok) {
          setPanel("none");
          setStatus(null);
          return;
        }
      }
      await flashProduct({
        port,
        product,
        status: manifest,
        unidentified: detected.usb.kind === "other",
        onProgress: ({ message, percent: next }) => {
          setStatus(message);
          setPercent(next);
        },
      });
      portRef.current = null;
      setDetected(null);
      setPanel("after-flash");
      setStatus(null);
      setPercent(null);
    } catch (err) {
      setError(errorMessage(err));
      setPanel("none");
      setStatus(null);
      setPercent(null);
    } finally {
      setBusy(false);
    }
  }

  function openWifi() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Detect the device again.");
      return;
    }
    setPanel("wifi");
    setError(null);
    setScanHint(null);
  }

  async function runScan() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Detect the device again.");
      return;
    }
    setBusy(true);
    setScanHint(null);
    setError(null);
    setStatus("Scanning Wi-Fi…");
    appendUsbLog("— scan —");
    try {
      const result = await scanNetworks(session, appendUsbLog, (state) => {
        if (state == null) setScanHint(PING_MISS_COPY);
      });
      setNetworks(result.networks);
      if (result.networks.length === 0) {
        if (result.ping == null) {
          setScanHint(PING_MISS_COPY);
        } else if (!result.finished) {
          setScanHint(
            "No list from the device (silence, not an empty scan). Enter the SSID manually. See USB debug.",
          );
        } else {
          setScanHint("No networks reported. Enter the SSID manually.");
        }
      } else {
        setScanHint(null);
      }
      setStatus(null);
    } catch (err) {
      setScanHint(errorMessage(err));
      appendUsbLog(`error ${errorMessage(err)}`);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function runSaveWifi() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Detect the device again.");
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
      setPassword("");
      setStatus("Wi-Fi saved.");
      await reread(session);
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }


  async function runToken() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Detect the device again.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Saving device token…");
    try {
      const token = await mintUsbDeviceToken(usbKeyName());
      try {
        await writeConsoleNvs(session, token, PRODUCT_CONSOLE_URL);
      } catch (err) {
        throw new Error(
          `${errorMessage(err)} The key was created; revoke it on API keys if this device did not save it.`,
        );
      }
      setStatus("Token saved.");
      await reread(session);
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function runPair() {
    const session = sessionRef.current;
    const card = detected?.huesta;
    if (!session || session.dead || !card) {
      setError("Detect the device again.");
      return;
    }
    if (card.key && !window.confirm(PAIR_CONFIRM)) return;
    setBusy(true);
    setError(null);
    setStatus(PAIR_PROMPT);
    const started = Date.now();
    try {
      const ack = await huePair(session, appendUsbLog);
      if (ack === "no-wifi") {
        setError("The board is not on Wi-Fi.");
        setStatus(null);
        return;
      }
      setStatus(PAIR_PROMPT);
      let paired = false;
      while (Date.now() - started < 90_000) {
        if (session.dead) {
          setError("Serial port lost. Detect the device again.");
          setStatus(null);
          break;
        }
        const remain = 90_000 - (Date.now() - started);
        if (remain <= 0) break;
        const next = await hueGet(session, Math.min(4000, remain), appendUsbLog);
        if (next) {
          setDetected((prev) => (prev ? { ...prev, huesta: next } : prev));
          if (next.key) {
            paired = true;
            break;
          }
        }
        const after = 90_000 - (Date.now() - started);
        if (after <= 0) break;
        await sleep(Math.min(1000, after));
      }
      if (paired) setStatus(null);
      else if (!session.dead) {
        setStatus("Pairing did not finish. The board is not paired.");
      }
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function runClear() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Detect the device again.");
      return;
    }
    if (!window.confirm(CLEAR_CONFIRM)) return;
    setBusy(true);
    setError(null);
    setStatus("Clearing saved data…");
    try {
      await hueClear(session, appendUsbLog);
      const card = await hueGetSettled(session, appendUsbLog);
      const looked = await readConsole(card);
      setDetected((prev) =>
        prev
          ? {
              ...prev,
              huesta: card,
              consoleRecord: looked.record,
              consoleError: looked.error,
            }
          : prev,
      );
      if (!card) {
        setError("Cleared, but the board did not return a stored card.");
        setStatus(null);
      } else {
        setStatus("Cleared.");
      }
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const productId = detected
    ? flashProductFor({
        usbKind: detected.usb.kind,
        boardChoice: detected.boardChoice,
        improv: detected.improv,
        huesta: detected.huesta,
      })
    : null;
  const product = productId ? PRODUCTS[productId] : null;
  const actions = detected
    ? decideActions({
        usbKind: detected.usb.kind,
        boardChoice: detected.boardChoice,
        improv: detected.improv,
        huesta: detected.huesta,
        manifestVersion: detected.manifest?.version ?? null,
      })
    : null;
  const binsReady = Boolean(
    detected?.manifest && detected.manifest.missing.length === 0,
  );
  const versionCmp =
    detected?.huesta && detected.manifest
      ? compareVersions(detected.huesta.ver, detected.manifest.version)
      : null;
  const flashBusy = busy && panel === "flash";
  const flashText =
    actions?.flash === "update"
      ? "Update"
      : actions?.flash === "reinstall"
        ? "Reinstall"
        : "Install";


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
        <h2 className="text-sm font-medium">Detect</h2>
        <p className="text-sm text-muted">
          Choose the USB serial port. The card shows what this board has saved,
          not a live probe.
        </p>
        <button
          type="button"
          disabled={Boolean(blocked) || busy}
          onClick={() => void detect()}
          className="w-fit rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
        >
          {busy && status === "Reading the device…" ? "Detecting…" : "Detect device"}
        </button>
      </section>

      {panel === "after-flash" ? (
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-cream p-4">
          <h2 className="text-sm font-medium">Reconnect USB</h2>
          <p className="text-sm text-muted">
            After reset the COM port may change. Detect the device again.
          </p>
        </section>
      ) : null}

      {detected && actions ? (
        <>
          <div
            className={
              detected.consoleRecord ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"
            }
          >
            <section className="flex flex-col gap-2 rounded-xl border border-line bg-cream p-4">
              <h2 className="text-sm font-medium">USB</h2>
              <p className="font-mono text-sm">{detected.usb.idText}</p>
              <p className="font-medium">
                {sketchTitle(learnedChip(detected.improv, detected.huesta)) ??
                  detected.usb.title}
              </p>
              {detected.huesta?.mac ? (
                <dl>
                  <Field label="MAC" value={formatMac(detected.huesta.mac)} mono />
                </dl>
              ) : null}
              {detected.improv ? (
                <p className="text-sm">
                  {detected.improv.name || "Firmware"}
                  {detected.improv.version ? (
                    <>
                      {" · "}
                      <FirmwareVersion
                        productId={productId}
                        version={detected.improv.version}
                      />
                    </>
                  ) : null}
                </p>
              ) : null}
              {actions.unsupported && status !== "Detecting chip…" ? (
                <p className="text-sm text-warn">Not supported.</p>
              ) : null}
              {detected.consoleError ? (
                <p className="text-sm text-muted">
                  Could not read the console record for this MAC.
                </p>
              ) : null}
            </section>

            {detected.consoleRecord ? (
              <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-medium">Console record</h2>
                  <p className="text-sm text-muted">
                    Stored for this login. It does not replace the USB card.
                  </p>
                </div>
                <dl className="grid gap-3">
                  <Field
                    label="Last seen"
                    value={formatSeen(detected.consoleRecord.lastSeenAt)}
                  />
                  <Field
                    label="Firmware"
                    value={detected.consoleRecord.firmware ?? "—"}
                    mono
                    href={
                      detected.consoleRecord.firmware
                        ? firmwareChangelogHref(
                            productId,
                            detected.consoleRecord.firmware,
                          )
                        : null
                    }
                  />
                </dl>
                {mismatchText(detected.consoleRecord, reportedVersion(detected)) ? (
                  <p className="text-sm text-warn">
                    {mismatchText(detected.consoleRecord, reportedVersion(detected))}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>

          {actions.showSaved && detected.huesta ? (
            <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium">Saved</h2>
                <p className="text-sm text-muted">
                  What this board has stored. No console call and no Bridge call
                  are made to fill this card.
                </p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field label="SSID" value={detected.huesta.ssid || "—"} />
                <Field
                  label="Wi-Fi"
                  value={detected.huesta.wifi === "up" ? "Up" : "Down"}
                />
                <Field label="IP" value={detected.huesta.ip || "—"} mono />
                <Field label="Bridge id" value={detected.huesta.bid || "—"} mono />
                <Field label="Bridge IP" value={detected.huesta.bip || "—"} mono />
                <Field label="URL" value={detected.huesta.url || "—"} mono />
                <Field label="Token" value={detected.huesta.token ? "Yes" : "No"} />
                <Field label="Paired" value={detected.huesta.key ? "Yes" : "No"} />
              </dl>
            </section>
          ) : null}


          {actions.cross ? (
            <p className="text-sm text-warn">
              This firmware does not match this USB board. Wi-Fi, token, pairing,
              and clear are off. Install writes only this board&apos;s firmware.
            </p>
          ) : null}

          {!actions.unsupported &&
          !actions.askBoard &&
          !actions.cross &&
          !actions.showSaved &&
          (detected.usb.kind === "c6" ||
            detected.usb.kind === "s3" ||
            detected.cdc) ? (
            <p className="text-sm text-muted">
              {detected.cdc
                ? "No stored card. Wi-Fi and Install still work."
                : "No stored card."}
            </p>
          ) : null}

          {actions.askBoard ? (
            <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
              <h2 className="text-sm font-medium">Board</h2>
              <p className="text-sm text-muted">
                {detected.usb.kind === "bootloader"
                  ? "Bootloader. This USB id does not say C6 or S3. Choose the board, then install its firmware. The chip read while flashing still has to match, or the write is aborted."
                  : "This port did not identify the board. Choose C6 or S3, then install. Install reads the chip before it writes. If it does not answer, hold BOOT and try again. If it answers and it is the other chip, the write is aborted."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["c6", "XIAO ESP32-C6"],
                  ["s3", "XIAO ESP32-S3"],
                ] as const).map(([choice, title]) => {
                  const selected = detected.boardChoice === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={busy}
                      onClick={() => void chooseBoard(choice)}
                      className={`rounded-lg border px-4 py-3 text-left ${
                        selected
                          ? "border-filament bg-filament-soft"
                          : "border-line bg-background hover:border-filament/50"
                      }`}
                    >
                      <p className="font-medium">{title}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {product && detected.manifestLoading ? (
            <p className="text-sm text-muted">Loading firmware manifest…</p>
          ) : null}
          {product && detected.manifestError ? (
            <p className="text-sm text-danger" role="alert">
              {detected.manifestError}
            </p>
          ) : null}
          {product && detected.manifest ? (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                {actions.showSaved && detected.huesta ? (
                  <>
                    Board{" "}
                    {detected.huesta.ver ? (
                      <FirmwareVersion
                        productId={productId}
                        version={detected.huesta.ver}
                      />
                    ) : (
                      <span className="font-mono text-xs">—</span>
                    )}
                    {" · published "}
                  </>
                ) : (
                  "Published firmware "
                )}
                <FirmwareVersion
                  productId={productId}
                  version={detected.manifest.version}
                />
                <span className="text-muted"> · {detected.manifest.manifest.name}</span>
              </p>
              {detected.manifest.missing.length > 0 ? (
                <p className="text-warn">
                  Firmware images are not published yet (
                  {detected.manifest.missing.join(", ")}). Flash is unavailable
                  until CI exports bootloader, partitions, boot_app0, and app.
                  {actions.wifi
                    ? " Wi-Fi still works on a board that already has firmware."
                    : ""}
                </p>
              ) : actions.flash !== "none" ? (
                <p className="text-muted">Images ready. Flash does not erase NVS.</p>
              ) : null}
            </div>
          ) : null}

          {actions.showSaved &&
          detected.manifest &&
          !detected.manifestLoading &&
          versionCmp === 1 ? (
            <p className="text-sm text-muted">
              This board is newer than the published firmware. There is no update
              and no reinstall.
            </p>
          ) : null}
          {actions.showSaved &&
          detected.manifest &&
          !detected.manifestLoading &&
          versionCmp === null ? (
            <p className="text-sm text-muted">
              This firmware version cannot be compared, so update and reinstall
              are hidden.
            </p>
          ) : null}

          {actions.flash !== "none" || actions.wifi || actions.token || actions.pair ? (
            <div className="flex flex-wrap gap-3">
              {actions.flash === "install" || actions.flash === "update" ? (
                <button
                  type="button"
                  disabled={Boolean(blocked) || busy || !product || !binsReady}
                  onClick={() => void runFlash()}
                  className="rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
                >
                  {flashBusy ? "Flashing…" : flashText}
                </button>
              ) : null}
              {actions.wifi && detected.cdc ? (
                <button
                  type="button"
                  disabled={Boolean(blocked) || busy}
                  onClick={openWifi}
                  className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  Wi-Fi
                </button>
              ) : null}
              {actions.token ? (
                <button
                  type="button"
                  disabled={Boolean(blocked) || busy}
                  onClick={() => void runToken()}
                  className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {busy && status === "Saving device token…" ? "Saving…" : "Token"}
                </button>
              ) : null}
              {actions.pair ? (
                <button
                  type="button"
                  disabled={Boolean(blocked) || busy}
                  onClick={() => void runPair()}
                  className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {busy && status === PAIR_PROMPT ? "Pairing…" : "Pair"}
                </button>
              ) : null}
              {actions.flash === "reinstall" ? (
                <button
                  type="button"
                  disabled={Boolean(blocked) || busy || !product || !binsReady}
                  onClick={() => void runFlash()}
                  className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {flashBusy ? "Flashing…" : "Reinstall"}
                </button>
              ) : null}
            </div>
          ) : null}

          {actions.clear ? (
            <div className="flex">
              <button
                type="button"
                disabled={Boolean(blocked) || busy}
                onClick={() => void runClear()}
                className="rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
              >
                {busy && status === "Clearing saved data…" ? "Clearing…" : "Clear"}
              </button>
            </div>
          ) : null}

          {actions.showSaved && detected.huesta && provisioningDone(detected.huesta) ? (
            <section className="rounded-xl border border-ok/40 bg-ok-soft p-4 text-sm text-ok">
              <p className="font-medium text-foreground">
                Wi-Fi and the console token are saved.
              </p>
              <p className="mt-2 text-muted">
                Pairing with the Hue Bridge is separate. This page does not wait
                for the switch list.
              </p>
            </section>
          ) : null}
        </>
      ) : null}


      {panel === "flash" ? (
        <section className="rounded-xl border border-line bg-cream p-4 text-sm">
          <p className="font-medium">{status ?? "Flashing…"}</p>
          {percent != null ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-filament" style={{ width: `${percent}%` }} />
            </div>
          ) : null}
        </section>
      ) : null}

      {panel === "wifi" ? (
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-cream p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Wi-Fi (2.4 GHz)</h2>
            <p className="text-sm text-muted">
              Scan or type the network. The password is not shown again. Saving
              Wi-Fi does not write a token.
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
                      {network.auth && network.auth !== "NO" ? ` · ${network.auth}` : ""}
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
            onClick={() => void runSaveWifi()}
            className="w-fit rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
          >
            {busy && status?.startsWith("Connecting") ? "Saving…" : "Save Wi-Fi"}
          </button>
        </section>
      ) : null}

      {status && panel !== "flash" ? (
        <p className="text-sm text-muted" role="status">
          {status}
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

      <details className="rounded-md border border-line bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">USB debug</summary>
        <p className="mt-1 text-xs text-muted">
          Improv packets and HUE lines from the XIAO. The token, the Wi-Fi
          password, and the Hue key are not logged.
        </p>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">
          {usbLog.length ? usbLog.join("\n") : "No USB traffic yet."}
        </pre>
        {usbLog.length ? (
          <button
            type="button"
            className="mt-2 text-xs text-muted underline"
            onClick={() => void navigator.clipboard.writeText(usbLog.join("\n"))}
          >
            Copy log
          </button>
        ) : null}
      </details>
    </div>
  );
}

