"use client";

import Link from "next/link";
import { ChangelogItemText } from "@/app/changelog-item";
import { firmwareChangelogHref } from "@/lib/changelog-href";
import { agoText, CONSOLE_QUIET_MIN, minutesSince } from "@/lib/ago";
import type { FirmwareNotes } from "@/lib/firmware";
import { notesBetween, type VersionNotes } from "@/lib/firmware-notes";
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
  PRODUCT_CONSOLE_URL,
  PRODUCTS,
  usbKeyName,
  type ProductId,
  type ProductSpec,
} from "@/lib/web-setup/products";
import { BytePort, reattachPort, requestSerialPort, sleep } from "@/lib/web-setup/serial";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const PAIR_CONFIRM =
  "This forgets the current Hue link and starts pairing again.";
const PAIR_PROMPT = "Press the button on the Hue Bridge.";
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
  // Wi-Fi update state (docs/specs/ota.md §3.1); null when the console did not say.
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


// Versions listed in full before they fold into "All changes" (docs/specs/finished/setup-update-notes.md §4.3).
const OPEN_VERSIONS = 3;

function VersionList({ notes }: { notes: VersionNotes[] }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.map((release) => (
        <div key={release.version}>
          <h4 className="text-sm font-medium">
            <span className="font-mono">{release.version}</span>
            <span className="ml-2 font-normal text-muted">{release.date}</span>
          </h4>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {release.items.map((item) => (
              <li key={item.text}>
                <ChangelogItemText item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function UpdateNotes({
  installed,
  latest,
  notes,
}: {
  installed: string;
  latest: string;
  notes: VersionNotes[];
}) {
  const important = notes.flatMap((release) =>
    release.items
      .filter((item) => item.important)
      .map((item) => ({ version: release.version, item })),
  );
  return (
    <div id="update-notes" className="flex scroll-mt-8 flex-col gap-3 px-2 py-2">
      <h3 className="text-sm font-medium">
        What changes from <span className="font-mono">{installed}</span> to{" "}
        <span className="font-mono">{latest}</span>
      </h3>
      {important.length > 0 ? (
        <ul className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
          {important.map(({ version, item }) => (
            <li key={`${version}-${item.text}`}>
              <ChangelogItemText item={item} />{" "}
              <span className="font-mono text-xs text-muted">({version})</span>
            </li>
          ))}
        </ul>
      ) : null}
      {notes.length <= OPEN_VERSIONS ? (
        <VersionList notes={notes} />
      ) : (
        <details>
          <summary className="cursor-pointer text-sm text-filament">
            All changes in {notes.length} versions
          </summary>
          <div className="mt-2">
            <VersionList notes={notes} />
          </div>
        </details>
      )}
    </div>
  );
}

function ActionRow({
  label,
  hint,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg px-2 py-2 sm:flex-row sm:items-center sm:gap-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-fit shrink-0 rounded-md px-3 py-2 text-sm disabled:opacity-60 sm:w-44 ${
          primary
            ? "bg-filament font-medium text-filament-ink"
            : "border border-line bg-background"
        }`}
      >
        {label}
      </button>
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

type CheckState = "done" | "warn" | "error" | "todo";

type CheckRow = { label: string; state: CheckState; text: string };

const CHECK_ICON: Record<CheckState, { mark: string; className: string; sr: string }> = {
  done: { mark: "✓", className: "bg-ok text-background", sr: "done" },
  warn: { mark: "!", className: "bg-warn text-background", sr: "warning" },
  error: { mark: "✕", className: "bg-danger text-background", sr: "problem" },
  todo: { mark: "", className: "border border-line text-muted", sr: "to do" },
};

// revoked: the board's last key was revoked. replacing: a new key was saved here and the
// board has not checked in with it yet.
type ConsoleLookup = "found" | "missing" | "error" | "revoked" | "replacing";

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
    : consoleLookup === "revoked"
      ? "error"
      : consoleLookup === "found" && !consoleQuiet
        ? "done"
        : "warn";
  // Waiting can fix these; the todo rows need the user.
  const settling =
    (wifiSaved && wifiState !== "done") || (linked && consoleState === "warn");
  return { seenMin, wifiSaved, wifiState, linked, consoleQuiet, consoleState, settling };
}

type Recheck = {
  countdown: number | null;
  checking: boolean;
  tries: number;
  canCheck: boolean;
  onStop: () => void;
  onCheckAgain: () => void;
};

function SetupChecklist({
  huesta,
  productId,
  manifestVersion,
  manifestLoading,
  versionCmp,
  importantCount,
  lastSeenAt,
  consoleLookup,
  switchHref,
  recheck,
}: {
  huesta: Huesta;
  productId: ProductId | null;
  manifestVersion: string | null;
  manifestLoading: boolean;
  versionCmp: -1 | 0 | 1 | null;
  importantCount: number;
  lastSeenAt: string | null;
  consoleLookup: ConsoleLookup;
  switchHref: string | null;
  recheck: Recheck;
}) {
  const { seenMin, wifiSaved, wifiState, linked, consoleQuiet, consoleState, settling } =
    liveChecks(huesta, lastSeenAt, consoleLookup);
  const autoLeft = settling && recheck.tries < RECHECK_TRIES;
  const firmwareOld = versionCmp === -1;
  const ver = huesta.ver || "Unknown version";
  const firmwareState: CheckState = manifestLoading
    ? "todo"
    : versionCmp === 0 || versionCmp === 1
      ? "done"
      : "warn";

  const rows: CheckRow[] = [
    {
      label: "Firmware",
      state: firmwareState,
      text: manifestLoading
        ? `${ver} · checking for updates…`
        : versionCmp === -1
          ? `${ver} · ${manifestVersion} is available${
              importantCount > 0
                ? ` · ${importantCount} important ${importantCount === 1 ? "note" : "notes"}`
                : ""
            }`
          : versionCmp === 0
            ? `${ver} (latest)`
            : versionCmp === 1
              ? `${ver} (newer than the latest release)`
              : `${ver} · can't check for updates`,
    },
    {
      label: "Wi-Fi",
      state: wifiState,
      text:
        wifiState === "todo"
          ? "No network saved"
          : wifiState === "done"
            ? `${huesta.ssid} · connected${huesta.ip ? ` (${huesta.ip})` : ""}`
            : wifiState === "warn"
              ? `${huesta.ssid} · reconnecting. It was not connected when read, but the console heard from it ${agoText(seenMin ?? 0)}.`
              : `${huesta.ssid} · not connected${seenMin !== null ? `, and the console last heard from it ${agoText(seenMin)}` : ""}.`,
    },
    {
      label: "Console",
      state: consoleState,
      text: !linked
        ? "Not linked"
        : consoleLookup === "revoked"
          ? "Key revoked · the console rejects this board"
          : consoleLookup === "replacing"
            ? "New key saved · waiting for the board to check in with it"
            : consoleLookup === "error"
          ? "Key saved · couldn't check when the console last heard from it"
          : consoleLookup === "missing" || seenMin === null
            ? "Key saved · the console has no record of this board yet"
            : consoleQuiet
              ? `Key saved · the console last heard from it ${agoText(seenMin)}`
              : `Linked · last heard from it ${agoText(seenMin)}`,
    },
    {
      label: "Hue Bridge",
      state: huesta.key ? "done" : "todo",
      text: huesta.key ? (huesta.bid ? `Paired with ${huesta.bid}` : "Paired") : "Not paired",
    },
  ];

  const next = !wifiSaved
      ? "Save a Wi-Fi network with Set up Wi-Fi below."
      : wifiState === "error"
        ? autoLeft
          ? "Wi-Fi can take a few seconds after the board restarts. The console checks again on its own."
          : "Wi-Fi is still not connected. Check the network name and password with Change Wi-Fi below."
        : !linked
          ? "Link the board to the console with Link to console below."
          : consoleState === "error"
            ? "This board's key was revoked on API keys. Give it a new one with Replace console key below."
          : !huesta.key
            ? "Pair with the Hue Bridge: press the button on the Bridge when the board asks, or use Pair with Bridge below."
            : wifiState === "warn"
              ? autoLeft
                ? "Wi-Fi should come back in a few seconds. The console checks again on its own."
                : "Wi-Fi has not come back. Check the network with Change Wi-Fi below."
              : consoleState === "warn" && consoleLookup !== "error"
                ? autoLeft
                  ? "The board checks in with the console shortly after it joins Wi-Fi. The console checks again on its own."
                  : "If the console still hasn't heard from it after a few minutes on Wi-Fi, its key may have been revoked. Use Replace console key below."
                : firmwareOld
                  ? importantCount > 0
                    ? (
                        <>
                          Read the{" "}
                          <a href="#update-notes" className="text-filament underline underline-offset-2">
                            important {importantCount === 1 ? "note" : "notes"}
                          </a>
                          , then update to {manifestVersion} with Update below. Settings stay.
                        </>
                      )
                    : `Update to ${manifestVersion} with Update below when convenient. Settings stay.`
                  : null;
  const guide = `/how-to?product=${productId === "round" ? "round" : "simple"}#status`;
  const guideText = productId === "round" ? "What the screen shows" : "What the LED shows";
  const allDone = rows.every((row) => row.state === "done");
  const anyError = rows.some((row) => row.state === "error");
  const setUp = rows.every((row) => row.state === "done" || row.state === "warn");

  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        allDone
          ? "border-ok/40 bg-ok-soft"
          : anyError
            ? "border-danger/40 bg-cream"
            : "border-line bg-cream"
      }`}
    >
      <h2 className="text-sm font-medium">
        {anyError ? "Needs attention" : setUp ? "This board is set up" : "Setup"}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => {
          const icon = CHECK_ICON[row.state];
          return (
            <li key={row.label} className="flex gap-2">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${icon.className}`}
              >
                {icon.mark}
              </span>
              <span className="min-w-0">
                <span className="font-medium">{row.label}</span>
                <span className="sr-only"> ({icon.sr})</span>
                <span className="text-muted"> · {row.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">
        {next ? (
          <>
            <span className="font-medium text-foreground">Next: </span>
            {next}{" "}
          </>
        ) : (
          <>
            Edit its {productId === "round" ? "pages" : "buttons"}:{" "}
            <Link
              href={switchHref ?? "/switches"}
              className="text-filament underline underline-offset-2"
            >
              Open in Switches
            </Link>
            .{" "}
          </>
        )}
        <Link href={guide} className="text-filament underline underline-offset-2">
          {guideText}
        </Link>{" "}
        tells you which step the board is on.
      </p>
      {recheck.checking ? (
        <p className="text-sm text-filament" role="status">
          Checking the board again…
        </p>
      ) : recheck.countdown !== null ? (
        <p className="text-sm text-filament" role="status">
          Checking again in {recheck.countdown} s (try {recheck.tries + 1} of{" "}
          {RECHECK_TRIES}).{" "}
          <button
            type="button"
            onClick={recheck.onStop}
            className="underline underline-offset-2"
          >
            Stop
          </button>
        </p>
      ) : settling && recheck.canCheck ? (
        <button
          type="button"
          onClick={recheck.onCheckAgain}
          className="w-fit rounded-md border border-line px-3 py-2 text-sm font-medium"
        >
          Check again
        </button>
      ) : null}
    </section>
  );
}

export function SetupPanel({
  expected,
  releaseNotes,
}: {
  // The switch a "Update to x" link came from (`/setup?mac=`), when this account has it.
  expected: { mac: string; name: string } | null;
  releaseNotes: Record<ProductId, FirmwareNotes[]>;
}) {
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
  const [recheckTries, setRecheckTries] = useState(RECHECK_TRIES);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [replacedKeyMac, setReplacedKeyMac] = useState<string | null>(null);
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
    setStatus(PICK_PORT);
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


  async function disconnect() {
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
    setNetworks([]);
    setSsid("");
    setPassword("");
    setScanHint(null);
    setUsbLog([]);
    setPercent(null);
    setRecheckTries(RECHECK_TRIES);
    setStatus("Port released. Other apps can use it now.");
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
      setError("Serial port lost. Detect the device again.");
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
      // The console cannot reset the C6 into its bootloader on Windows. When Detect found
      // the firmware running, Simple 0.2.11+ restarts into it on HUEBOOT; older firmware
      // answers HUEERR unknown and the person does BOOT+RESET instead.
      const firmwareRunning =
        product.chipFamily === "ESP32-C6" && (detected.improv !== null || detected.huesta !== null);
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
      if (!picked) throw new Error("Detect the device again.");
      const needsBoot = firmwareRunning && !booted;
      if (needsBoot) {
        const ok = window.confirm(
          "Hold BOOT on the Simple and keep holding it. Tap RESET, then click OK. Release BOOT only when the page says Writing firmware.",
        );
        if (!ok) {
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
          "The board came back on a new USB port after RESET. Click Detect, pick it, then Install.",
        );
      }
      portRef.current = port;
      appendUsbLog(port === picked ? "— install —" : "— install (board came back on a new port) —");
      if (detected.usb.kind === "other") {
        const board = product.board;
        const ok = window.confirm(
          `This writes the ${board} firmware. Hold BOOT, then click OK. If the chip does not answer, tap RESET while holding BOOT and try again. If this board is not a ${board}, it can fail to start.`,
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
        alreadyOpen: openPort !== null,
        onLog: appendUsbLog,
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
      // Close the form so the checklist can follow the board as it joins.
      setPanel("none");
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
      setError("Detect the device again.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Saving device token…");
    try {
      const token = await mintUsbDeviceToken(
        usbKeyName({ mac: detected?.huesta?.mac, productId }),
      );
      try {
        await writeConsoleNvs(session, token, PRODUCT_CONSOLE_URL);
      } catch (err) {
        throw new Error(
          `${errorMessage(err)} The key was created; revoke it on API keys if this device did not save it.`,
        );
      }
      setStatus("Token saved.");
      setReplacedKeyMac(detected?.huesta?.mac ?? null);
      await reread(session);
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
        setError(
          "The board is not on Wi-Fi yet. It can take a few seconds after Detect. Wait a moment and try again.",
        );
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
  const showChecklist = Boolean(
    actions?.showSaved && detected?.huesta && !actions.cross,
  );
  const installedVersion = detected ? reportedVersion(detected) : "";
  const updateNotes =
    actions?.flash === "update" && productId && detected?.manifest
      ? notesBetween(releaseNotes[productId], installedVersion, detected.manifest.version)
      : [];
  const importantCount = updateNotes.reduce(
    (count, release) => count + release.items.filter((item) => item.important).length,
    0,
  );
  const consoleLookup: ConsoleLookup = detected?.consoleRecord
    ? detected.consoleRecord.keyRevoked
      ? replacedKeyMac === detected.huesta?.mac
        ? "replacing"
        : "revoked"
      : "found"
    : detected?.consoleError
      ? "error"
      : "missing";
  const settling = Boolean(
    showChecklist &&
      detected?.cdc &&
      detected.huesta &&
      liveChecks(
        detected.huesta,
        detected.consoleRecord?.lastSeenAt ?? null,
        consoleLookup,
      ).settling,
  );
  const autoRecheck =
    settling && !busy && panel === "none" && recheckTries < RECHECK_TRIES;

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
        {expected ? (
          <p className="text-sm">
            Updating <span className="font-medium">{expected.name}</span>. Plug
            it in over USB and press Detect.
          </p>
        ) : null}
        <p className="text-sm text-muted">
          Plug the board in with a USB-C cable that carries data, then choose
          its port. It is usually listed as a USB serial or JTAG device.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(blocked) || busy}
            onClick={() => void detect()}
            className="w-fit rounded-md bg-filament px-3 py-2 text-sm font-medium text-filament-ink disabled:opacity-60"
          >
            {busy && (status === PICK_PORT || status === READING)
              ? "Detecting…"
              : detected
                ? "Detect another device"
                : "Detect device"}
          </button>
          {detected && !busy ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="w-fit rounded-md border border-line px-3 py-2 text-sm font-medium"
            >
              Disconnect
            </button>
          ) : null}
        </div>
        {busy && status === PICK_PORT ? (
          <p className="text-sm text-filament" role="status">
            {PICK_PORT}
          </p>
        ) : null}
        {expected && detected?.huesta?.mac && detected.huesta.mac !== expected.mac ? (
          <p className="text-sm text-warn" role="status">
            This is{" "}
            {detected.consoleRecord?.label?.trim() || formatMac(detected.huesta.mac)},
            not {expected.name}.
          </p>
        ) : null}
      </section>

      {panel === "after-flash" ? (
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-cream p-4">
          <h2 className="text-sm font-medium">Reconnect USB</h2>
          <p className="text-sm text-muted">
            After reset the COM port may change. Detect the device again.
          </p>
        </section>
      ) : null}

      {reading ? (
        <section
          className="flex items-center gap-3 rounded-xl border border-line bg-cream p-4"
          role="status"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-filament"
          />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{READING}</p>
            <p className="text-sm text-muted">This takes a few seconds. Keep it plugged in.</p>
          </div>
        </section>
      ) : null}

      {detected && actions && !reading && !choosing ? (
        <>
          {showChecklist && detected.huesta ? (
            <SetupChecklist
              huesta={detected.huesta}
              productId={productId}
              manifestVersion={detected.manifest?.version ?? null}
              manifestLoading={detected.manifestLoading}
              versionCmp={versionCmp}
              importantCount={importantCount}
              lastSeenAt={detected.consoleRecord?.lastSeenAt ?? null}
              consoleLookup={consoleLookup}
              switchHref={
                detected.consoleRecord && detected.huesta.mac
                  ? `/switches/${detected.huesta.mac}`
                  : null
              }
              recheck={{
                countdown: autoRecheck ? (countdown ?? RECHECK_SECONDS) : null,
                checking: rechecking,
                tries: recheckTries,
                canCheck: !busy && Boolean(detected.cdc),
                onStop: () => setRecheckTries(RECHECK_TRIES),
                onCheckAgain: () => void recheck(false),
              }}
            />
          ) : null}

          <section className="flex flex-col gap-1 rounded-xl border border-line bg-cream p-4">
            <h2 className="font-medium">
              {sketchTitle(learnedChip(detected.improv, detected.huesta)) ??
                detected.usb.title}
            </h2>
            <p className="text-sm text-muted">
              {detected.improv ? (
                <>
                  {detected.improv.name || "Firmware"}
                  {detected.improv.version ? (
                    <>
                      {" "}
                      <FirmwareVersion
                        productId={productId}
                        version={detected.improv.version}
                      />
                    </>
                  ) : null}
                </>
              ) : product && detected.manifest && !actions.showSaved ? (
                <>
                  Latest firmware{" "}
                  <FirmwareVersion
                    productId={productId}
                    version={detected.manifest.version}
                  />{" "}
                  · {detected.manifest.manifest.name}
                </>
              ) : (
                "No switch firmware detected"
              )}
              {detected.huesta?.mac ? (
                <>
                  {" · MAC "}
                  <span className="font-mono text-xs">
                    {formatMac(detected.huesta.mac)}
                  </span>
                </>
              ) : null}
            </p>
            {actions.unsupported && status !== "Detecting chip…" ? (
              <p className="text-sm text-warn">Not supported.</p>
            ) : null}
            {detected.consoleError ? (
              <p className="text-sm text-muted">
                Could not read the console record for this board.
              </p>
            ) : null}
            {detected.consoleRecord &&
            mismatchText(detected.consoleRecord, reportedVersion(detected)) ? (
              <p className="text-sm text-warn">
                {mismatchText(detected.consoleRecord, reportedVersion(detected))}
              </p>
            ) : null}
          </section>

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
                ? "This board has no switch settings yet. Install firmware, then save Wi-Fi."
                : "This board has no switch settings yet."}
            </p>
          ) : null}

          {actions.askBoard ? (
            <section className="flex flex-col gap-3 rounded-xl border border-line bg-cream p-4">
              <h2 className="text-sm font-medium">Board</h2>
              <p className="text-sm text-muted">
                {detected.usb.kind === "bootloader"
                  ? "Bootloader. This USB id does not say C6 or S3. Choose the board, then install its firmware. The chip read while flashing still has to match, or the write is aborted."
                  : "This port did not identify the board. Choose C6 or S3. Hold BOOT, then click Install. If it does not answer, tap RESET while holding BOOT and try again. If it answers and it is the other chip, the write is aborted."}
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
            <p className="text-sm text-muted">Loading firmware…</p>
          ) : null}
          {product && detected.manifestError ? (
            <p className="text-sm text-danger" role="alert">
              {detected.manifestError}
            </p>
          ) : null}
          {product && detected.manifest && detected.manifest.missing.length > 0 ? (
            <p className="text-sm text-warn">
              Firmware images are not published yet (
              {detected.manifest.missing.join(", ")}). Install is unavailable
              until CI exports bootloader, partitions, boot_app0, and app.
              {actions.wifi
                ? " Wi-Fi still works on a board that already has firmware."
                : ""}
            </p>
          ) : null}
          {actions.showSaved &&
          detected.manifest &&
          !detected.manifestLoading &&
          versionCmp === 1 ? (
            <p className="text-sm text-muted">
              This board is newer than the published firmware, so there is
              nothing to update or reinstall.
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
            <section className="flex flex-col gap-1 rounded-xl border border-line bg-cream p-2">
              <h2 className="px-2 pt-1 text-sm font-medium">Actions</h2>
              {updateNotes.length > 0 && detected.manifest ? (
                <UpdateNotes
                  installed={installedVersion}
                  latest={detected.manifest.version}
                  notes={updateNotes}
                />
              ) : null}
              {actions.flash === "install" || actions.flash === "update" ? (
                <ActionRow
                  primary
                  label={flashBusy ? "Installing…" : flashText}
                  disabled={Boolean(blocked) || busy || !product || !binsReady}
                  onClick={() => void runFlash()}
                  hint={
                    actions.flash === "update"
                      ? `Install ${detected.manifest?.version ?? "the latest firmware"}. Wi-Fi, the console link, and ${productId === "round" ? "pages" : "buttons"} stay.`
                      : `Install the ${productId === "round" ? "Round" : "Simple"} switch firmware${detected.manifest ? `, version ${detected.manifest.version}` : ""}.`
                  }
                />
              ) : null}
              {actions.wifi && detected.cdc ? (
                <ActionRow
                  label={detected.huesta?.ssid ? "Change Wi-Fi" : "Set up Wi-Fi"}
                  disabled={Boolean(blocked) || busy}
                  onClick={openWifi}
                  hint="Scan for a 2.4 GHz network and save it on the board."
                />
              ) : null}
              {actions.token ? (
                <ActionRow
                  label={
                    busy && status === "Saving device token…"
                      ? "Saving…"
                      : detected.huesta?.token
                        ? "Replace console key"
                        : "Link to console"
                  }
                  disabled={Boolean(blocked) || busy}
                  onClick={() => void runToken()}
                  hint={
                    detected.huesta?.token
                      ? "Make a new key for this board. Only needed if the old one was revoked."
                      : "Make a key for this board and save it, so it can talk to the console."
                  }
                />
              ) : null}
              {actions.pair ? (
                <ActionRow
                  label={
                    busy && status === PAIR_PROMPT
                      ? "Pairing…"
                      : detected.huesta?.key
                        ? "Pair again"
                        : "Pair with Bridge"
                  }
                  disabled={Boolean(blocked) || busy}
                  onClick={() => void runPair()}
                  hint={
                    detected.huesta?.key
                      ? "Forget the current Hue link and pair from scratch. Press the button on the Bridge when asked."
                      : "Press the button on the Hue Bridge when asked."
                  }
                />
              ) : null}
              {actions.flash === "reinstall" ? (
                <ActionRow
                  label={flashBusy ? "Installing…" : "Reinstall"}
                  disabled={Boolean(blocked) || busy || !product || !binsReady}
                  onClick={() => void runFlash()}
                  hint={`Install ${detected.manifest?.version ?? "this version"} again. Settings stay.`}
                />
              ) : null}
            </section>
          ) : null}

          {actions.showSaved && detected.huesta ? (
            <details className="group rounded-xl border border-line bg-cream p-4">
              <summary className="cursor-pointer text-sm font-medium">Details</summary>
              <p className="mt-2 text-sm text-muted">
                What the board reported when you clicked Detect. Wi-Fi and IP are
                its connection at that moment; the rest is saved on the board.
              </p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="SSID" value={detected.huesta.ssid || "—"} />
                <Field
                  label="Wi-Fi"
                  value={
                    detected.huesta.wifi === "up" ? "Connected" : "Not connected when read"
                  }
                />
                <Field label="IP" value={detected.huesta.ip || "—"} mono />
                <Field label="Bridge id" value={detected.huesta.bid || "—"} mono />
                <Field label="Bridge IP" value={detected.huesta.bip || "—"} mono />
                <Field label="Console URL" value={detected.huesta.url || "—"} mono />
                <Field
                  label="Console key"
                  value={
                    !detected.huesta.token
                      ? "No"
                      : consoleLookup === "revoked"
                        ? "Yes · revoked"
                        : "Yes"
                  }
                />
                <Field label="Hue key" value={detected.huesta.key ? "Yes" : "No"} />
                <Field label="USB id" value={detected.usb.idText} mono />
                {detected.consoleRecord ? (
                  <>
                    <Field
                      label="Console last heard from it"
                      value={formatSeen(detected.consoleRecord.lastSeenAt)}
                    />
                    <Field
                      label="Firmware the console has on record"
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
          ) : null}

          {actions.clear ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="text-sm font-medium text-danger">Reset board</h2>
                <p className="text-sm text-muted">
                  Erase Wi-Fi, the console link, the Hue link, and{" "}
                  {productId === "round" ? "pages" : "recipes"}. The firmware stays.
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(blocked) || busy}
                onClick={() => void runClear()}
                className="rounded-md border border-danger/60 px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                {busy && status === "Clearing saved data…" ? "Erasing…" : "Erase settings"}
              </button>
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

      {status && panel !== "flash" && status !== PICK_PORT && status !== READING ? (
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
    </div>
  );
}

