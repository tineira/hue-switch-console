"use client";

import Link from "next/link";
import { firmwareChangelogHref } from "@/lib/changelog-href";
import { agoText, CONSOLE_QUIET_MIN, minutesSince } from "@/lib/ago";
import type { FirmwareNotes } from "@/lib/firmware";
import { notesBetween } from "@/lib/firmware-notes";
import { UpdateNotes } from "@/app/update-notes";
import { otaErrorText } from "@/lib/ota";
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
  type BoardChoice,
  type Huesta,
  type ImprovSeen,
  type UsbIdentity,
} from "@/lib/web-setup/devices";
import { ChipMismatchError, flashProduct } from "@/lib/web-setup/flash";
import { hueBoot, hueClear, hueGet, hueGetSettled, huePair } from "@/lib/web-setup/huecmd";
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
  consoleMove,
  isLoopbackConsole,
  moveConfirmText,
  resolveDeviceConsoleUrl,
} from "@/lib/console-url";
import {
  PRODUCTS,
  usbKeyName,
  type ProductId,
  type ProductSpec,
} from "@/lib/web-setup/products";
import { BytePort, reattachPort, requestSerialPort, sleep } from "@/lib/web-setup/serial";
import { setupSteps } from "@/lib/how-to";
import {
  BEFORE_YOU_START,
  HUEBOOT_SINCE,
  PORT_NAME,
  guideSteps,
  type GuideStep,
  type GuideStepId,
} from "@/lib/setup-guide";
import { Illo } from "@/app/how-to/illo/illo";
import { StateVisual } from "@/app/how-to/visuals";
import {
  ButtonSteps,
  CantBreak,
  ChipList,
  PortPickerMock,
  StepHelp,
  StepRow,
  type StepState,
} from "@/app/setup/guide-parts";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const PAIR_CONFIRM =
  "This forgets the current Hue link and starts pairing again.";
const PAIR_PROMPT = "Press the button on the Hue Bridge.";
const PAIR_MS = 90_000;
const PICK_PORT = "Choose the board's port in the window Chrome opened.";
const READING = "Reading the board…";
const CLEAR_CONFIRM =
  "This forgets Wi-Fi, the console token, the Hue link, and saved recipes or pages. The firmware stays.";

type ConsoleRecord = {
  lastSeenAt: string | null;
  firmware: string | null;
  label: string | null;
  // The key this board last used was revoked on API keys.
  keyRevoked: boolean;
  // Wi-Fi update state (docs/specs/finished/ota.md §3.1); null when the console did not say.
  otaStatus: string | null;
  otaError: string | null;
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

type Panel = "none" | "flash" | "after-flash";

// Install waits on the page for the person's hands: "boot" is BOOT+RESET on the Simple, "hold"
// is BOOT held on a board Chrome could not identify (the Round resets itself once it answers).
type Gate = { kind: "boot" | "hold"; resolve: (go: boolean) => void };

// How the Simple gets into install mode (docs/specs/finished/usb-download-mode.md).
type InstallMode = "auto" | "hueboot" | "buttons";

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
  const min = minutesSince(value);
  return min === null ? value : agoText(min);
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
      label?: unknown;
      key_revoked?: unknown;
      ota_status?: unknown;
      ota_error?: unknown;
    };
    if (body.found !== true) return "missing";
    return {
      lastSeenAt: typeof body.last_seen_at === "string" ? body.last_seen_at : null,
      firmware: typeof body.firmware === "string" ? body.firmware : null,
      label: typeof body.label === "string" ? body.label : null,
      keyRevoked: body.key_revoked === true,
      otaStatus: typeof body.ota_status === "string" ? body.ota_status : null,
      otaError: typeof body.ota_error === "string" ? body.ota_error : null,
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

const PRIMARY =
  "w-fit rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60";
const SECONDARY =
  "w-fit rounded-md border border-line bg-background px-3 py-2 text-sm font-medium disabled:opacity-60";

function ActionRow({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  hint: ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:gap-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="w-fit shrink-0 rounded-md border border-line bg-background px-3 py-2 text-sm disabled:opacity-60 sm:w-44"
      >
        {label}
      </button>
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

type CheckState = "done" | "warn" | "error" | "todo";

// revoked: the board's last key was revoked. replacing: a new key was saved here and the
// board has not checked in with it yet. elsewhere: the board talks to another console's host
// (docs/specs/self-hosting.md §5 decision 2).
type ConsoleLookup = "found" | "missing" | "error" | "revoked" | "replacing" | "elsewhere";

// Automatic rereads after Detect, on the already-open port (reopening resets the Round).
const RECHECK_TRIES = 3;
const RECHECK_SECONDS = 10;

// Wi-Fi and console are the live rows: read at Detect time, and a board that just
// restarted can still be joining. If the console heard from the board recently it is
// most likely reconnecting (warn); otherwise it is offline (error).
function liveChecks(
  huesta: Huesta,
  lastSeenAt: string | null,
  consoleLookup: ConsoleLookup,
) {
  const seenMin = minutesSince(lastSeenAt);
  const seenRecently = seenMin !== null && seenMin <= 15;
  const wifiSaved = huesta.ssid.length > 0;
  const wifiState: CheckState = !wifiSaved
    ? "todo"
    : huesta.wifi === "up"
      ? "done"
      : seenRecently
        ? "warn"
        : "error";
  const linked = huesta.token && huesta.url.length > 0;
  // Boards check in at start-up and then about once an hour, so allow a margin.
  const consoleQuiet = seenMin === null || seenMin > CONSOLE_QUIET_MIN;
  const consoleState: CheckState = !linked
    ? "todo"
    : consoleLookup === "revoked" || consoleLookup === "elsewhere"
      ? "error"
      : consoleLookup === "found" && !consoleQuiet
        ? "done"
        : "warn";
  // Waiting can fix these; the todo rows need the user. Waiting does not bring back a board
  // that talks to another console.
  const settling =
    (wifiSaved && wifiState !== "done") ||
    (linked && consoleState === "warn");
  return { seenMin, wifiSaved, wifiState, linked, consoleQuiet, consoleState, settling };
}

function pageOriginSnapshot() {
  return window.location.origin;
}

// Raw state of each step: what the board reported, before one of them is picked to be open.
type RawState = CheckState | "later";

export function SetupPanel({
  expected,
  releaseNotes,
  configuredConsoleUrl,
}: {
  // The switch a "Update to x" link came from (`/setup?mac=`), when this account has it.
  expected: { mac: string; name: string } | null;
  releaseNotes: Record<ProductId, FirmwareNotes[]>;
  // DEVICE_CONSOLE_URL, else BETTER_AUTH_URL; null means "the origin of this page".
  configuredConsoleUrl: string | null;
}) {
  const blocked = useSyncExternalStore(
    subscribeNoop,
    webSerialBlockedReason,
    () => null,
  );
  const pageOrigin = useSyncExternalStore(subscribeNoop, pageOriginSnapshot, () => null);
  // What Link to console writes with HUESET url (docs/specs/self-hosting.md §2.1).
  const deviceConsoleUrl = resolveDeviceConsoleUrl({
    deviceConsoleUrl: configuredConsoleUrl,
    pageOrigin,
  });
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
  const [recheckTries, setRecheckTries] = useState(RECHECK_TRIES);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [replacedKeyMac, setReplacedKeyMac] = useState<string | null>(null);
  // Which switch the pictures show before a board is connected.
  const [chosenProduct, setChosenProduct] = useState<ProductId>("simple");
  // The step the person opened by hand ("none": they closed the open one); null follows the board.
  const [openStep, setOpenStep] = useState<GuideStepId | "none" | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [pairLeft, setPairLeft] = useState<number | null>(null);
  const [flashed, setFlashed] = useState<ProductId | null>(null);
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

  // `all`: list every serial port, not only XIAOs (a board under another vendor id).
  async function detect(all = false) {
    if (blocked) return;
    const gen = ++detectGen.current;
    setBusy(true);
    setError(null);
    setStatus(PICK_PORT);
    setPanel("none");
    setOpenStep(null);
    try {
      const port = await requestSerialPort(all);
      if (gen !== detectGen.current) return;
      await closeSession();
      if (gen !== detectGen.current) return;
      portRef.current = port;
      setFlashed(null);
      setNetworks([]);
      setSsid("");
      setPassword("");
      setScanHint(null);
      setUsbLog([]);
      setRecheckTries(0);
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
        setStatus(READING);
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

  async function disconnect(message = "Port released. Other apps can use it now.") {
    ++detectGen.current;
    ++manifestGen.current;
    setBusy(true);
    setError(null);
    try {
      await closeSession();
    } catch {
      /* port already gone; nothing left to release */
    }
    portRef.current = null;
    setDetected(null);
    setPanel("none");
    setOpenStep(null);
    setFlashed(null);
    setNetworks([]);
    setSsid("");
    setPassword("");
    setScanHint(null);
    setUsbLog([]);
    setPercent(null);
    setRecheckTries(RECHECK_TRIES);
    setStatus(message);
    setBusy(false);
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

  // Reread on the open session only. Opening the port again would reset the Round.
  async function recheck(auto: boolean) {
    const session = sessionRef.current;
    setCountdown(null);
    if (auto) setRecheckTries((n) => n + 1);
    if (!session || session.dead) {
      setRecheckTries(RECHECK_TRIES);
      setError("Serial port lost. Connect the board again.");
      return;
    }
    setBusy(true);
    setRechecking(true);
    setError(null);
    setStatus(null);
    appendUsbLog("— check again —");
    try {
      await reread(session);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRechecking(false);
      setBusy(false);
    }
  }

  function waitForHands(kind: Gate["kind"]): Promise<boolean> {
    return new Promise((resolve) => setGate({ kind, resolve }));
  }

  function releaseGate(go: boolean) {
    gate?.resolve(go);
    setGate(null);
  }

  async function runFlash() {
    if (!detected || !product || !detected.manifest || blocked) return;
    if (detected.manifest.missing.length > 0) return;
    const manifest = detected.manifest;
    setBusy(true);
    setError(null);
    setPanel("flash");
    setOpenStep(null);
    setPercent(null);
    setStatus("Getting the board ready…");
    try {
      // The console cannot reset the C6 into its bootloader on Windows. When Detect found
      // the firmware running, Simple 0.2.11+ restarts into it on HUEBOOT; otherwise (older
      // firmware, the factory program, a blank chip) the person does BOOT+RESET.
      const simple = product.chipFamily === "ESP32-C6";
      const firmwareRunning = simple && (detected.improv !== null || detected.huesta !== null);
      let booted = false;
      const session = sessionRef.current;
      if (firmwareRunning && session && !session.dead) {
        appendUsbLog("— HUEBOOT —");
        try {
          booted = (await hueBoot(session, appendUsbLog)) === "ok";
        } catch {
          booted = false;
        }
      }
      // HUEBOOT restarts the chip without dropping USB. Keep that port open for esptool:
      // opening the C6 port again resets the chip and undoes the restart into download mode.
      let openPort: SerialPort | null = null;
      if (booted && session) {
        sessionRef.current = null;
        openPort = await session.detach();
        portRef.current = openPort;
      } else {
        await closeSession();
      }
      setDetected((prev) => (prev ? { ...prev, cdc: false } : prev));
      const picked = portRef.current;
      if (!picked) throw new Error("Connect the board again.");
      const needsBoot = simple && !booted;
      if (needsBoot) {
        setStatus("Waiting for BOOT and RESET…");
        if (!(await waitForHands("boot"))) {
          setPanel("none");
          setStatus(null);
          return;
        }
      }
      let port: SerialPort | null;
      if (openPort) {
        appendUsbLog("— install: after HUEBOOT (port kept open) —");
        await sleep(300);
        port = openPort;
      } else {
        // Give the COM port time to come back after RESET; opening it mid re-enumeration stalls.
        if (needsBoot) await sleep(1500);
        appendUsbLog(needsBoot ? "— install: after BOOT+RESET —" : "— install: port check —");
        port = await reattachPort(picked, needsBoot ? 6000 : 3000, appendUsbLog);
      }
      if (!port) {
        throw new Error(
          "The board came back on a new USB port after RESET. Click Connect, pick it, then Install.",
        );
      }
      portRef.current = port;
      appendUsbLog(port === picked ? "— install —" : "— install (board came back on a new port) —");
      if (detected.usb.kind === "other" && !simple) {
        setStatus("Waiting for BOOT…");
        if (!(await waitForHands("hold"))) {
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
        alreadyOpen: openPort !== null,
        onLog: appendUsbLog,
        onProgress: ({ message, percent: next }) => {
          setStatus(message);
          setPercent(next);
        },
      });
      portRef.current = null;
      setFlashed(productId);
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
      setGate(null);
      setBusy(false);
    }
  }

  async function runScan() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Connect the board again.");
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
            "No list from the device (silence, not an empty scan). Enter the network name yourself. See USB debug.",
          );
        } else {
          setScanHint("No networks reported. Enter the network name yourself.");
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
      setError("Connect the board again.");
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
      // Let the stepper follow the board as it joins.
      setOpenStep(null);
      setRecheckTries(0);
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
      setError("Connect the board again.");
      return;
    }
    const target = deviceConsoleUrl;
    if (!target) {
      setError("This console does not know its own address. Set DEVICE_CONSOLE_URL.");
      return;
    }
    // A board set up for another console is only moved after the person says so (§5 decision 2).
    const move = consoleMove(detected?.huesta?.url, target);
    if (move.kind === "move" && !window.confirm(moveConfirmText(move.from, target))) return;
    setBusy(true);
    setError(null);
    setStatus("Saving device token…");
    try {
      const token = await mintUsbDeviceToken(
        usbKeyName({ mac: detected?.huesta?.mac, productId }),
      );
      try {
        await writeConsoleNvs(session, token, target);
      } catch (err) {
        throw new Error(
          `${errorMessage(err)} The key was created; revoke it on API keys if this device did not save it.`,
        );
      }
      setStatus("Key saved.");
      setReplacedKeyMac(detected?.huesta?.mac ?? null);
      await reread(session);
      setOpenStep(null);
      setRecheckTries(0);
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
      setError("Connect the board again.");
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
        setError(
          "The board is not on Wi-Fi yet. It can take a few seconds after it restarts. Wait a moment and try again.",
        );
        setStatus(null);
        return;
      }
      setStatus(PAIR_PROMPT);
      let paired = false;
      while (Date.now() - started < PAIR_MS) {
        if (session.dead) {
          setError("Serial port lost. Connect the board again.");
          setStatus(null);
          break;
        }
        const remain = PAIR_MS - (Date.now() - started);
        if (remain <= 0) break;
        setPairLeft(Math.ceil(remain / 1000));
        const next = await hueGet(session, Math.min(4000, remain), appendUsbLog);
        if (next) {
          setDetected((prev) => (prev ? { ...prev, huesta: next } : prev));
          if (next.key) {
            paired = true;
            break;
          }
        }
        const after = PAIR_MS - (Date.now() - started);
        if (after <= 0) break;
        setPairLeft(Math.ceil(after / 1000));
        await sleep(Math.min(1000, after));
      }
      if (paired) {
        setStatus(null);
        setOpenStep(null);
      } else if (!session.dead) {
        setStatus("Pairing did not finish. The board is not paired. Try again.");
      }
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    } finally {
      setPairLeft(null);
      setBusy(false);
    }
  }

  async function runClear() {
    const session = sessionRef.current;
    if (!session || session.dead) {
      setError("Connect the board again.");
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
      setOpenStep(null);
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
  const installedVersion = detected ? reportedVersion(detected) : "";
  const updateNotes =
    actions?.flash === "update" && productId && detected?.manifest
      ? notesBetween(releaseNotes[productId], installedVersion, detected.manifest.version)
      : [];
  const importantCount = updateNotes.reduce(
    (count, release) => count + release.items.filter((item) => item.important).length,
    0,
  );
  const boardMove =
    detected?.huesta?.token && deviceConsoleUrl
      ? consoleMove(detected.huesta.url, deviceConsoleUrl)
      : null;
  const otherConsole = boardMove?.kind === "move" ? boardMove.from : null;
  const consoleLookup: ConsoleLookup = otherConsole
    ? "elsewhere"
    : detected?.consoleRecord
    ? detected.consoleRecord.keyRevoked
      ? replacedKeyMac === detected.huesta?.mac
        ? "replacing"
        : "revoked"
      : "found"
    : detected?.consoleError
      ? "error"
      : "missing";
  // The board's own firmware card, unless it runs another product's firmware.
  const card = detected?.huesta && actions?.showSaved && !actions.cross ? detected.huesta : null;
  const live = card
    ? liveChecks(card, detected?.consoleRecord?.lastSeenAt ?? null, consoleLookup)
    : null;
  const settling = Boolean(live?.settling && detected?.cdc);
  const autoRecheck = settling && !busy && panel === "none" && recheckTries < RECHECK_TRIES;

  const fireRecheck = useEffectEvent(() => void recheck(true));
  useEffect(() => {
    if (!autoRecheck) return;
    let left = RECHECK_SECONDS;
    const timer = setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCountdown(left);
      } else {
        clearInterval(timer);
        fireRecheck();
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      // A paused countdown starts over at full length when it resumes.
      setCountdown(null);
    };
  }, [autoRecheck, recheckTries]);

  const flashBusy = busy && panel === "flash";
  const reading = busy && status === READING;
  // Hide the last result while a new port is being chosen or read.
  const choosing = busy && status === PICK_PORT;
  const connected = Boolean(detected && actions && !reading && !choosing);
  const flashText =
    actions?.flash === "update"
      ? "Update"
      : actions?.flash === "reinstall"
        ? "Reinstall"
        : "Install";

  // ---------------------------------------------------------------- the stepper's states

  // Pictures and texts follow the board once it is known, the picker before that.
  const shown: ProductId = productId ?? flashed ?? chosenProduct;
  const round = shown === "round";
  const guide = guideSteps(shown);
  const step = (id: GuideStepId) => guide.find((g) => g.id === id) as GuideStep;
  // What the board shows once each step is done (the How-to "Then it shows" pictures).
  const howTo = setupSteps(shown);
  const shows: Partial<Record<GuideStepId, (typeof howTo)[number]["shows"]>> = {
    firmware: howTo[1]?.shows,
    wifi: howTo[2]?.shows,
    console: howTo[3]?.shows,
    bridge: howTo[4]?.shows,
  };
  const ver = card?.ver || "Unknown version";
  const manifestVersion = detected?.manifest?.version ?? null;

  const firmwareRaw: RawState = !connected
    ? "later"
    : actions?.unsupported
      ? "error"
      : actions?.cross
        ? "error"
        : !card
          ? "todo"
          : detected?.manifestLoading
            ? "done"
            : versionCmp === -1
              ? "warn"
              : "done";
  const raw: Record<GuideStepId, RawState> = {
    connect: connected ? "done" : "todo",
    firmware: firmwareRaw,
    wifi: !live ? "later" : live.wifiState,
    console: !live ? "later" : live.consoleState,
    bridge: !card ? "later" : card.key ? "done" : "todo",
  };
  const ORDER: GuideStepId[] = ["connect", "firmware", "wifi", "console", "bridge"];
  const firstTodo = ORDER.find((id) => raw[id] === "todo" || raw[id] === "error") ?? null;
  // Nothing left to do but an update: open the firmware step on it.
  const autoOpen: GuideStepId | null =
    firstTodo ?? (raw.firmware === "warn" && actions?.flash === "update" ? "firmware" : null);
  const open: GuideStepId | null =
    panel === "flash" || gate
      ? "firmware"
      : openStep === "none"
        ? null
        : (openStep ?? autoOpen);
  const display = (id: GuideStepId): StepState => {
    const r = raw[id];
    if (r === "later") return "later";
    if (r === "todo") return id === firstTodo ? "current" : "later";
    return r;
  };
  const toggle = (id: GuideStepId) => () => setOpenStep(open === id ? "none" : id);
  const allDone = Boolean(card) && firstTodo === null;
  const switchHref =
    detected?.consoleRecord && card?.mac ? `/switches/${card.mac}` : "/switches";
  const sessionAlive = Boolean(detected?.cdc);

  const boardTitle = detected
    ? (sketchTitle(learnedChip(detected.improv, detected.huesta)) ?? detected.usb.title)
    : null;

  const feedback = (
    <>
      {status &&
      panel !== "flash" &&
      status !== PICK_PORT &&
      status !== READING &&
      status !== PAIR_PROMPT ? (
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
    </>
  );

  function showsNext(id: GuideStepId) {
    const next = shows[id];
    if (!next) return null;
    return (
      <div className="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center">
          <StateVisual visual={next.visual} label={next.caption} size={56} version={manifestVersion} />
        </span>
        <span className="flex flex-col gap-0.5 text-sm">
          <span className="text-xs text-muted">
            Then the {round ? "screen" : "orange LED on the board"} shows
          </span>
          <span>{next.caption}</span>
        </span>
      </div>
    );
  }

  // How this install gets the board into install mode.
  const hueboot = card ? compareVersions(card.ver, HUEBOOT_SINCE) : null;
  const installMode: InstallMode =
    shown === "round" ? "auto" : hueboot === 0 || hueboot === 1 ? "hueboot" : "buttons";

  // ---------------------------------------------------------------- step bodies

  const connectBody = connected && detected ? (
    <>
      <p>
        <span className="font-medium">{boardTitle}</span>
        <span className="text-muted">
          {" · "}
          {detected.improv ? (
            <>
              {detected.improv.name || "Firmware"}
              {detected.improv.version ? (
                <>
                  {" "}
                  <FirmwareVersion productId={productId} version={detected.improv.version} />
                </>
              ) : null}
            </>
          ) : (
            "no switch firmware yet"
          )}
          {card?.mac ? (
            <>
              {" · MAC "}
              <span className="font-mono text-xs">{formatMac(card.mac)}</span>
            </>
          ) : null}
        </span>
      </p>
      {expected && card?.mac && card.mac !== expected.mac ? (
        <p className="text-sm text-warn" role="status">
          This is {detected.consoleRecord?.label?.trim() || formatMac(card.mac)}, not {expected.name}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(blocked) || busy} onClick={() => void detect()} className={SECONDARY}>
          Connect another board
        </button>
        <button type="button" disabled={busy} onClick={() => void disconnect()} className={SECONDARY}>
          Disconnect
        </button>
      </div>
    </>
  ) : (
    <>
      {flashed ? (
        <div className="flex flex-col gap-3 rounded-lg border border-ok/40 bg-ok-soft p-3">
          <p className="font-medium text-ok">Firmware installed.</p>
          {flashed === "simple" ? (
            <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
              <ButtonSteps
                items={[
                  { n: 2, text: "Tap **RESET** once, so the board starts the new firmware." },
                  { text: "Click **Connect** and pick the board again. Windows may give it a new COM number." },
                ]}
              />
              <Illo id="simple-buttons" alt="The XIAO ESP32-C6 seen from above: 1 BOOT and 2 RESET on either side of the USB-C socket." />
            </div>
          ) : (
            <p className="text-sm text-muted">
              The Round restarts by itself. Click <span className="font-medium text-foreground">Connect</span>{" "}
              and pick it again to carry on.
            </p>
          )}
        </div>
      ) : null}
      {expected ? (
        <p>
          Updating <span className="font-medium">{expected.name}</span>. Plug it in and click Connect.
        </p>
      ) : null}
      {!flashed ? (
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Which switch">
          <span className="text-xs text-muted">Setting up a</span>
          {(["simple", "round"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chosenProduct === id}
              onClick={() => setChosenProduct(id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                chosenProduct === id ? "border-filament bg-filament-soft text-filament" : "border-line"
              }`}
            >
              {id === "simple" ? "Simple switch" : "Round switch"}
            </button>
          ))}
        </div>
      ) : null}
      <ButtonSteps
        items={[
          { text: "Plug the XIAO into this computer with a USB-C cable that carries data." },
          { text: "Click **Connect**." },
          { n: 1, text: `In the window Chrome opens, pick **${PORT_NAME}** and click **Connect**.` },
        ]}
      />
      <div className="grid items-center gap-4 sm:grid-cols-2">
        <Illo
          id={round ? "round-plug" : "simple-plug"}
          alt={round ? "The Round with a USB-C cable to this computer." : "The XIAO ESP32-C6 with a USB-C cable to this computer."}
        />
        <PortPickerMock />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={Boolean(blocked) || busy}
          onClick={() => void detect()}
          className={PRIMARY}
        >
          {choosing || reading ? "Connecting…" : "Connect"}
        </button>
        <button
          type="button"
          disabled={Boolean(blocked) || busy}
          onClick={() => void detect(true)}
          className="text-sm text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-60"
        >
          My board isn&apos;t in the list
        </button>
      </div>
      {choosing ? (
        <p className="text-sm text-filament" role="status">
          {PICK_PORT}
        </p>
      ) : null}
      {reading ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-filament"
          />
          {READING} This takes a few seconds. Keep it plugged in.
        </p>
      ) : null}
      {feedback}
      <StepHelp why={step("connect").why} trouble={step("connect").trouble} />
    </>
  );

  const installButton =
    actions && (actions.flash === "install" || actions.flash === "update" || actions.flash === "reinstall") ? (
      <button
        type="button"
        disabled={Boolean(blocked) || busy || !product || !binsReady}
        onClick={() => void runFlash()}
        className={PRIMARY}
      >
        {flashBusy ? "Installing…" : flashText}
      </button>
    ) : null;

  const firmwareBody = detected && actions ? (
    <>
      {actions.unsupported ? (
        <p className="text-warn">
          This board isn&apos;t supported. The switches use the XIAO ESP32-C6 (Simple) or the XIAO
          ESP32-S3 (Round).
        </p>
      ) : null}
      {actions.cross ? (
        <p className="text-warn">
          This board runs firmware for another switch. Wi-Fi, the console link and pairing are off
          until you install this board&apos;s own firmware.
        </p>
      ) : null}
      {actions.askBoard ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted">
            This port doesn&apos;t say which XIAO it is. Pick the switch you are setting up. If the
            chip turns out to be the other one, nothing is written.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["c6", "Simple switch", "XIAO ESP32-C6"],
              ["s3", "Round switch", "XIAO ESP32-S3"],
            ] as const).map(([choice, name, chip]) => {
              const selected = detected.boardChoice === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={busy}
                  onClick={() => void chooseBoard(choice)}
                  className={`rounded-lg border px-4 py-3 text-left ${
                    selected ? "border-filament bg-filament-soft" : "border-line bg-background hover:border-filament/50"
                  }`}
                >
                  <span className="block font-medium">{name}</span>
                  <span className="block text-xs text-muted">{chip}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {product && detected.manifestLoading ? <p className="text-muted">Loading firmware…</p> : null}
      {product && detected.manifestError ? (
        <p className="text-danger" role="alert">
          {detected.manifestError}
        </p>
      ) : null}
      {product && detected.manifest && detected.manifest.missing.length > 0 ? (
        <p className="text-warn">
          Firmware images are not published yet ({detected.manifest.missing.join(", ")}). Install is
          unavailable until CI exports bootloader, partitions, boot_app0, and app.
        </p>
      ) : null}
      {card && detected.manifest && !detected.manifestLoading && versionCmp === 1 ? (
        <p className="text-muted">
          This board is newer than the published firmware, so there is nothing to update or reinstall.
        </p>
      ) : null}
      {card && detected.manifest && !detected.manifestLoading && versionCmp === null ? (
        <p className="text-muted">This firmware version cannot be compared, so update and reinstall are hidden.</p>
      ) : null}
      {detected.consoleError ? (
        <p className="text-muted">Could not read the console record for this board.</p>
      ) : null}
      {detected.consoleRecord && mismatchText(detected.consoleRecord, reportedVersion(detected)) ? (
        <p className="text-warn">{mismatchText(detected.consoleRecord, reportedVersion(detected))}</p>
      ) : null}
      {updateNotes.length > 0 && detected.manifest ? (
        <UpdateNotes installed={installedVersion} latest={detected.manifest.version} notes={updateNotes} />
      ) : null}

      {product && manifestVersion && !actions.unsupported ? (
        <p>
          {actions.flash === "update"
            ? `Installs ${manifestVersion}. Wi-Fi, the console link and the ${round ? "pages" : "buttons"} stay.`
            : `Installs the ${round ? "Round" : "Simple"} switch firmware, version ${manifestVersion}.`}
        </p>
      ) : null}

      {gate ? (
        <div className="flex flex-col gap-3 rounded-lg border border-filament bg-filament-soft p-3" role="alert">
          <p className="font-medium">Now, on the board:</p>
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
            <ButtonSteps
              items={
                gate.kind === "boot"
                  ? [
                      { n: 1, text: "Hold **BOOT** and keep holding it." },
                      { n: 2, text: "Tap **RESET**." },
                      { text: "Click **Continue**, still holding BOOT." },
                      { text: "Let go of BOOT when the page says **Writing firmware**." },
                    ]
                  : [
                      { n: 1, text: "Hold **BOOT** and keep holding it." },
                      { text: "Click **Continue**. If the chip does not answer, tap **RESET** while holding BOOT and try again." },
                    ]
              }
            />
            {gate.kind === "boot" ? (
              <Illo id="simple-buttons" alt="The XIAO ESP32-C6 seen from above: 1 BOOT and 2 RESET on either side of the USB-C socket." />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => releaseGate(true)} className={PRIMARY}>
              Continue
            </button>
            <button type="button" onClick={() => releaseGate(false)} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      ) : panel === "flash" ? (
        <div className="rounded-lg bg-background p-3" role="status">
          <p className="font-medium">{status ?? "Installing…"}</p>
          {percent != null ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-filament" style={{ width: `${percent}%` }} />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted">Keep the cable in. This takes about a minute.</p>
        </div>
      ) : !actions.unsupported ? (
        <>
          {installMode === "buttons" ? (
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
              <div className="flex flex-col gap-2">
                <p className="text-muted">
                  This board needs two buttons to take new firmware. After you click {flashText}, the
                  page asks you to:
                </p>
                <ButtonSteps
                  items={[
                    { n: 1, text: "Hold **BOOT**," },
                    { n: 2, text: "tap **RESET**, then click Continue." },
                    { n: 2, text: "When it's written, tap **RESET** once more." },
                  ]}
                />
              </div>
              <Illo id="simple-buttons" alt="The XIAO ESP32-C6 seen from above: 1 BOOT and 2 RESET on either side of the USB-C socket." />
            </div>
          ) : installMode === "hueboot" ? (
            <p className="text-muted">
              No buttons until the end: the console restarts the board into install mode. When it&apos;s
              written, tap <span className="font-medium text-foreground">RESET</span> once on the
              board, next to the USB-C socket.
            </p>
          ) : (
            <p className="text-muted">No buttons to press: the console restarts the Round by itself.</p>
          )}
          {installButton}
          {actions.flash === "install" ? showsNext("firmware") : null}
        </>
      ) : null}
      <CantBreak />
      {feedback}
      <StepHelp why={step("firmware").why} trouble={step("firmware").trouble} />
    </>
  ) : null;

  const wifiBody = (
    <>
      {!sessionAlive ? (
        <p className="text-muted">Connect the board again to change its Wi-Fi.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            Click <span className="font-medium text-foreground">Scan</span>, pick your 2.4 GHz network
            and type its password. The password is not shown again.
          </p>
          <button type="button" disabled={busy} onClick={() => void runScan()} className={SECONDARY}>
            {busy && status?.startsWith("Scanning") ? "Scanning…" : "Scan"}
          </button>
          {scanHint ? <p className="text-muted">{scanHint}</p> : null}
          {networks.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {networks.map((network) => (
                <li key={network.ssid}>
                  <button
                    type="button"
                    onClick={() => setSsid(network.ssid)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      ssid === network.ssid ? "border-filament bg-filament-soft" : "border-line bg-background"
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
            <label className="flex flex-col gap-1">
              <span className="font-medium">Network name</span>
              <input
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
                autoComplete="off"
                className="rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-filament"
              />
            </label>
            <label className="flex flex-col gap-1">
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
            className={PRIMARY}
          >
            {busy && status?.startsWith("Connecting") ? "Saving…" : "Save Wi-Fi"}
          </button>
        </div>
      )}
      {round ? (
        <p className="text-xs text-muted">The Round needs its antenna clicked into its socket to reach the router.</p>
      ) : null}
      {showsNext("wifi")}
      {feedback}
      <StepHelp why={step("wifi").why} trouble={step("wifi").trouble} />
    </>
  );

  const consoleBody = (
    <>
      <p className="text-muted">
        {otherConsole
          ? `It talks to ${otherConsole} now. Make a key here and point it at this console.`
          : consoleLookup === "revoked"
            ? "This board's key was revoked on API keys. Give it a new one."
            : card?.token
              ? "Make a new key for this board. Only needed if the old one was revoked."
              : "Make a key for this board and save it on the board, so it can fetch its setup."}{" "}
        {deviceConsoleUrl ? (
          <>
            It will talk to <span className="font-mono text-xs text-foreground">{deviceConsoleUrl}</span>.
            {isLoopbackConsole(deviceConsoleUrl) ? (
              <span className="text-warn">
                {" "}
                A board can&apos;t reach this address. Set DEVICE_CONSOLE_URL to this computer&apos;s
                LAN address first.
              </span>
            ) : null}
          </>
        ) : null}
      </p>
      {sessionAlive ? (
        <button
          type="button"
          disabled={Boolean(blocked) || busy || !deviceConsoleUrl}
          onClick={() => void runToken()}
          className={PRIMARY}
        >
          {busy && status === "Saving device token…"
            ? "Saving…"
            : otherConsole
              ? "Move to this console"
              : card?.token
                ? "Replace console key"
                : "Link to console"}
        </button>
      ) : (
        <p className="text-muted">Connect the board again to link it.</p>
      )}
      {showsNext("console")}
      {feedback}
      <StepHelp why={step("console").why} trouble={step("console").trouble} />
    </>
  );

  const pairing = busy && status === PAIR_PROMPT;
  const bridgeBody = (
    <>
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="flex flex-col gap-3">
          <ButtonSteps
            items={[
              { text: "Stand next to your Hue Bridge and click **Pair with Bridge**." },
              { n: 1, text: "Press the round link button on top of the Bridge once. A short press is enough." },
              { text: "The step turns green when the Bridge lets the board in." },
            ]}
          />
          {sessionAlive ? (
            <button
              type="button"
              disabled={Boolean(blocked) || busy || !actions?.pair}
              onClick={() => void runPair()}
              className={PRIMARY}
            >
              {pairing ? "Pairing…" : card?.key ? "Pair again" : "Pair with Bridge"}
            </button>
          ) : (
            <p className="text-muted">Connect the board again to pair it.</p>
          )}
          {pairing ? (
            <p className="rounded-lg border border-filament bg-filament-soft px-3 py-2 font-medium" role="status">
              Press the button on the Hue Bridge now.
              {pairLeft !== null ? <span className="font-normal text-muted"> Waiting {pairLeft} s…</span> : null}
            </p>
          ) : null}
          {!actions?.pair ? <p className="text-muted">Save Wi-Fi first: the board finds the Bridge over Wi-Fi.</p> : null}
        </div>
        <Illo id="hue-bridge" alt="A Hue Bridge seen from the front: 1 the round link button in the middle of the top, pressed once." />
      </div>
      {showsNext("bridge")}
      {feedback}
      <StepHelp why={step("bridge").why} trouble={step("bridge").trouble} />
    </>
  );

  // ---------------------------------------------------------------- summaries

  const firmwareSummary = !card
    ? actions?.unsupported
      ? "Not supported"
      : "Not installed yet"
    : detected?.manifestLoading
      ? `${ver} · checking for updates…`
      : versionCmp === -1
        ? `${ver} · ${manifestVersion} is available${
            importantCount > 0 ? ` · ${importantCount} important ${importantCount === 1 ? "note" : "notes"}` : ""
          }`
        : versionCmp === 0
          ? `${ver} (latest)`
          : versionCmp === 1
            ? `${ver} (newer than the latest release)`
            : `${ver} · can't check for updates`;
  const seenMin = live?.seenMin ?? null;
  const wifiSummary = !card
    ? null
    : live?.wifiState === "todo"
      ? "No network saved"
      : live?.wifiState === "done"
        ? `${card.ssid} · connected${card.ip ? ` (${card.ip})` : ""}`
        : live?.wifiState === "warn"
          ? `${card.ssid} · reconnecting`
          : `${card.ssid} · not connected${seenMin !== null ? `; the console last heard from it ${agoText(seenMin)}` : ""}`;
  const consoleSummary = !card
    ? null
    : !live?.linked
      ? "Not linked"
      : consoleLookup === "elsewhere"
        ? `Linked to another console · ${otherConsole ?? card.url}`
        : consoleLookup === "revoked"
          ? "Key revoked · the console rejects this board"
          : consoleLookup === "replacing"
            ? "New key saved · waiting for the board to check in with it"
            : consoleLookup === "error"
              ? "Key saved · couldn't check when the console last heard from it"
              : consoleLookup === "missing" || seenMin === null
                ? "Key saved · waiting for the board to check in"
                : live.consoleQuiet
                  ? `Key saved · the console last heard from it ${agoText(seenMin)}`
                  : `Linked · last heard from it ${agoText(seenMin)}`;
  const bridgeSummary = !card ? null : card.key ? (card.bid ? `Paired with ${card.bid}` : "Paired") : "Not paired";

  const rows: { id: GuideStepId; summary: ReactNode; body: ReactNode }[] = [
    { id: "connect", summary: connected ? boardTitle : null, body: connectBody },
    { id: "firmware", summary: connected ? firmwareSummary : null, body: firmwareBody },
    { id: "wifi", summary: wifiSummary, body: wifiBody },
    { id: "console", summary: consoleSummary, body: consoleBody },
    { id: "bridge", summary: bridgeSummary, body: bridgeBody },
  ];

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

      {!connected ? <ChipList label="You need" items={BEFORE_YOU_START} /> : null}

      <ol className="flex flex-col">
        {rows.map((row, i) => (
          <StepRow
            key={row.id}
            n={i + 1}
            title={step(row.id).title}
            state={display(row.id)}
            summary={row.summary}
            open={open === row.id}
            last={i === rows.length - 1 && !allDone}
            onToggle={toggle(row.id)}
          >
            {row.body}
          </StepRow>
        ))}
        {allDone ? (
          <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
            <div className="flex justify-center">
              <span className="mt-4 flex h-6 w-6 items-center justify-center rounded-full bg-ok-soft text-ok">
                <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" />
                </svg>
              </span>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-ok/40 bg-ok-soft p-4 text-sm">
              <p className="font-semibold text-ok">This board is set up.</p>
              <p className="text-muted">
                Next, give its {round ? "pages a room or zone" : "buttons a job"}. Then unplug it and{" "}
                {round ? "put it where it goes" : "mount it"}. Changes reach the switch within about 15
                minutes, or right away if you unplug it and plug it back in.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={switchHref} className={PRIMARY}>
                  Set up its {round ? "pages" : "buttons"}
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void disconnect("Port released. Plug in the next board and click Connect.")}
                  className={SECONDARY}
                >
                  Set up another board
                </button>
              </div>
              {open === null ? feedback : null}
            </div>
          </li>
        ) : null}
      </ol>

      {settling ? (
        rechecking ? (
          <p className="text-sm text-filament" role="status">
            Checking the board again…
          </p>
        ) : autoRecheck ? (
          <p className="text-sm text-filament" role="status">
            The board is still joining. Checking again in {countdown ?? RECHECK_SECONDS} s (try{" "}
            {recheckTries + 1} of {RECHECK_TRIES}).{" "}
            <button type="button" onClick={() => setRecheckTries(RECHECK_TRIES)} className="underline underline-offset-2">
              Stop
            </button>
          </p>
        ) : !busy ? (
          <button
            type="button"
            onClick={() => void recheck(false)}
            className="w-fit rounded-md border border-line px-3 py-2 text-sm font-medium"
          >
            Check again
          </button>
        ) : null
      ) : null}

      {open === null && !allDone ? feedback : null}

      {connected && detected && card ? (
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium">Maintenance</summary>
          <div className="mt-3 flex flex-col gap-1">
            {actions?.flash === "reinstall" ? (
              <ActionRow
                label={flashBusy ? "Installing…" : "Reinstall"}
                disabled={Boolean(blocked) || busy || !product || !binsReady}
                onClick={() => void runFlash()}
                hint={`Install ${manifestVersion ?? "this version"} again. Settings stay.`}
              />
            ) : null}
            {sessionAlive ? (
              <ActionRow
                label="Change Wi-Fi"
                disabled={busy}
                onClick={() => setOpenStep("wifi")}
                hint="Save another 2.4 GHz network on the board."
              />
            ) : null}
            {sessionAlive && card.token ? (
              <ActionRow
                label="Replace console key"
                disabled={Boolean(blocked) || busy || !deviceConsoleUrl}
                onClick={() => void runToken()}
                hint="Make a new key for this board. Only needed if the old one was revoked."
              />
            ) : null}
            {sessionAlive && card.key && actions?.pair ? (
              <ActionRow
                label="Pair again"
                disabled={Boolean(blocked) || busy}
                onClick={() => setOpenStep("bridge")}
                hint="Forget the current Hue link and pair from scratch."
              />
            ) : null}
          </div>
          <details className="mt-3 rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">Details</summary>
            <p className="mt-2 text-sm text-muted">
              What the board reported when you connected it. Wi-Fi and IP are its connection at that
              moment; the rest is saved on the board.
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="SSID" value={card.ssid || "—"} />
              <Field label="Wi-Fi" value={card.wifi === "up" ? "Connected" : "Not connected when read"} />
              <Field label="IP" value={card.ip || "—"} mono />
              <Field label="Bridge id" value={card.bid || "—"} mono />
              <Field label="Bridge IP" value={card.bip || "—"} mono />
              <Field label="Console URL" value={card.url || "—"} mono />
              <Field
                label="Console key"
                value={!card.token ? "No" : consoleLookup === "revoked" ? "Yes · revoked" : "Yes"}
              />
              <Field label="Hue key" value={card.key ? "Yes" : "No"} />
              <Field label="USB id" value={detected.usb.idText} mono />
              {detected.consoleRecord ? (
                <>
                  <Field label="Console last heard from it" value={formatSeen(detected.consoleRecord.lastSeenAt)} />
                  <Field
                    label="Firmware the console has on record"
                    value={detected.consoleRecord.firmware ?? "—"}
                    mono
                    href={
                      detected.consoleRecord.firmware
                        ? firmwareChangelogHref(productId, detected.consoleRecord.firmware)
                        : null
                    }
                  />
                  {detected.consoleRecord.otaStatus === "offered" ||
                  detected.consoleRecord.otaStatus === "failed" ? (
                    <Field
                      label="Wi-Fi update"
                      value={
                        detected.consoleRecord.otaStatus === "failed"
                          ? `Failed: ${otaErrorText(detected.consoleRecord.otaError)}`
                          : "Offered on Switches; the switch installs it when it checks in"
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </dl>
          </details>
          {actions?.clear ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/40 p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium text-danger">Reset board</p>
                <p className="text-sm text-muted">
                  Erase Wi-Fi, the console link, the Hue link, and {round ? "pages" : "recipes"}. The
                  firmware stays.
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(blocked) || busy || !sessionAlive}
                onClick={() => void runClear()}
                className="rounded-md border border-danger/60 px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                {busy && status === "Clearing saved data…" ? "Erasing…" : "Erase settings"}
              </button>
            </div>
          ) : null}
        </details>
      ) : null}

      <details className="rounded-md border border-line bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">USB debug</summary>
        <p className="mt-1 text-xs text-muted">
          Improv packets and HUE lines from the XIAO, and how Install connected. The token, the Wi-Fi
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
      <p className="text-xs text-muted">
        Stuck?{" "}
        <Link href={`/how-to?product=${shown}&topic=status`} className="text-filament underline underline-offset-2">
          {round ? "What the screen shows" : "What the LED shows"}
        </Link>{" "}
        tells you which step the board is on.
      </p>
    </div>
  );
}
