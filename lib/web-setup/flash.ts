import type { ESPLoader as EspLoaderType } from "esptool-js";
import { chipFamilyMatches, type ProductSpec } from "@/lib/web-setup/products";
import {
  fetchFirmwareParts,
  type ManifestStatus,
} from "@/lib/web-setup/manifest";
import { sleep } from "@/lib/web-setup/serial";

export class ChipMismatchError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
    message: string,
  ) {
    super(message);
    this.name = "ChipMismatchError";
  }
}

export type FlashProgress = {
  message: string;
  percent: number | null;
};

type ResetMode = "usb_reset" | "no_reset" | "default_reset";

const RELOAD_HOLD_BOOT =
  "The USB port is still in use. Reload the page, hold BOOT, tap RESET, and click Install again.";

const CONNECT_DEADLINE_MS = 8000;
const PORT_UNLOCK_MS = 2000;

class ConnectTimeoutError extends Error {
  constructor() {
    super("Connecting timed out");
    this.name = "ConnectTimeoutError";
  }
}

function streamsLocked(port: SerialPort): boolean {
  return Boolean(port.readable?.locked || port.writable?.locked);
}

async function releaseHungPort(port: SerialPort, transport: object): Promise<void> {
  // setSignals on this Windows USB-JTAG port stays pending. readLoop holds the
  // readable lock; closing during that read kills Chrome. Do not call
  // setRTS, setDTR, or hardReset on this loader.
  if (port.readable?.locked) {
    const reader = (transport as { reader?: { cancel: () => Promise<void> } | null }).reader;
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* the unlock wait decides whether close is safe */
      }
    }
  }
  const deadline = Date.now() + PORT_UNLOCK_MS;
  while (streamsLocked(port) && Date.now() < deadline) {
    await sleep(Math.min(50, deadline - Date.now()));
  }
  if (streamsLocked(port)) {
    throw new Error(RELOAD_HOLD_BOOT);
  }
  try {
    await port.close();
  } catch (err) {
    if (!streamsLocked(port) && err instanceof DOMException && err.name === "InvalidStateError") {
      return;
    }
    throw new Error(RELOAD_HOLD_BOOT);
  }
}

async function connectWithDeadline(
  esploader: EspLoaderType,
  mode: ResetMode,
  ms: number,
): Promise<void> {
  let timedOut = false;
  const attempt = esploader.connect(mode, 2);
  const guarded = attempt.then(
    () => {
      if (timedOut) return;
    },
    (err: unknown) => {
      if (timedOut) return;
      throw err;
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      guarded,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new ConnectTimeoutError());
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ESP32-C6 on USB-Serial-JTAG: the RTC watchdog and the super watchdog keep running in
// download mode and reset the chip mid-flash. Python esptool disables them after connect
// (esp32c6.py disable_watchdogs); esptool-js 0.6.1 does not, so it is done here.
const USB_JTAG_SERIAL_PID = 0x1001;
const C6_LP_WDT_BASE = 0x600b1c00;
const C6_RWDT_CONFIG0 = C6_LP_WDT_BASE + 0x0;
const C6_RWDT_WPROTECT = C6_LP_WDT_BASE + 0x18;
const C6_SWD_CONFIG = C6_LP_WDT_BASE + 0x1c;
const C6_SWD_WPROTECT = C6_LP_WDT_BASE + 0x20;
const C6_WDT_WKEY = 0x50d83aa1;
const C6_SWD_AUTO_FEED_EN = 1 << 18;

async function disableC6Watchdogs(esploader: EspLoaderType): Promise<void> {
  if (esploader.transport.getPid() !== USB_JTAG_SERIAL_PID) return;
  await esploader.writeReg(C6_RWDT_WPROTECT, C6_WDT_WKEY);
  await esploader.writeReg(C6_RWDT_CONFIG0, 0);
  await esploader.writeReg(C6_RWDT_WPROTECT, 0);
  await esploader.writeReg(C6_SWD_WPROTECT, C6_WDT_WKEY);
  const swd = await esploader.readReg(C6_SWD_CONFIG);
  await esploader.writeReg(C6_SWD_CONFIG, (swd | C6_SWD_AUTO_FEED_EN) >>> 0);
  await esploader.writeReg(C6_SWD_WPROTECT, 0);
}

async function afterConnect(esploader: EspLoaderType, product: ProductSpec): Promise<string> {
  const detected = String(esploader.chip?.CHIP_NAME ?? "");
  if (detected && !chipFamilyMatches(detected, product.chipFamily)) {
    throw new ChipMismatchError(product.chipFamily, detected, product.mismatch);
  }
  if (!detected) return "";
  if (product.chipFamily === "ESP32-C6") await disableC6Watchdogs(esploader);
  await esploader.runStub();
  await esploader.changeBaud();
  await esploader.flashId();
  return detected;
}

function loaderFor(
  port: SerialPort,
  ESPLoader: new (options: {
    transport: InstanceType<typeof import("esptool-js").Transport>;
    baudrate: number;
    enableTracing: boolean;
    debugLogging: boolean;
    terminal: {
      clean: () => void;
      writeLine: (line: string) => void;
      write: (text: string) => void;
    };
  }) => InstanceType<typeof import("esptool-js").ESPLoader>,
  Transport: typeof import("esptool-js").Transport,
  log: (line: string) => void,
) {
  const transport = new Transport(port, false);
  // esptool's own lines (sync attempts, the boot mode it saw) go to the USB log on Devices.
  const esploader = new ESPLoader({
    transport,
    baudrate: 115200,
    enableTracing: false,
    debugLogging: true,
    terminal: {
      clean() {},
      writeLine(line) {
        if (line.trim()) log(line.trim());
      },
      write(text) {
        if (text.trim()) log(text.trim());
      },
    },
  });
  return { transport, esploader };
}

async function attachWithin(
  esploader: EspLoaderType,
  mode: ResetMode,
  product: ProductSpec,
): Promise<string> {
  await connectWithDeadline(esploader, mode, CONNECT_DEADLINE_MS);
  return afterConnect(esploader, product);
}

export async function flashProduct(options: {
  port: SerialPort;
  product: ProductSpec;
  status: ManifestStatus;
  /** The USB id did not name the board. The person already chose the firmware. */
  unidentified?: boolean;
  onProgress: (progress: FlashProgress) => void;
  onLog?: (line: string) => void;
}): Promise<string> {
  const { ESPLoader, Transport } = await import("esptool-js");
  // Only the connect is logged; the write would flood the log.
  let logging = true;
  const log = (line: string) => {
    if (logging) options.onLog?.(line);
  };
  let current = loaderFor(options.port, ESPLoader, Transport, log);

  // The S3 enters the bootloader when DTR/RTS toggle. The C6 USB-JTAG
  // setSignals call never returns on Windows and locks the reader, so that
  // board skips the toggle and waits in the bootloader (hold BOOT).
  const autoReset = options.product.chipFamily === "ESP32-S3";
  options.onProgress({
    message: autoReset ? "Connecting…" : "Connecting without reset… hold BOOT.",
    percent: null,
  });
  let detected: string;
  try {
    detected = await attachWithin(
      current.esploader,
      autoReset ? "default_reset" : "no_reset",
      options.product,
    );
  } catch (err) {
    try {
      await releaseHungPort(options.port, current.transport);
    } catch (releaseErr) {
      if (err instanceof ChipMismatchError) throw err;
      throw releaseErr;
    }
    if (err instanceof ChipMismatchError) throw err;
    if (!autoReset) {
      const detail = err instanceof Error ? err.message : "unknown";
      throw new Error(
        `Failed to initialize. Hold BOOT, tap RESET, and click Install again. (${detail})`,
      );
    }
    current = loaderFor(options.port, ESPLoader, Transport, log);
    options.onProgress({
      message: "Connecting without reset… hold BOOT.",
      percent: null,
    });
    try {
      detected = await attachWithin(current.esploader, "no_reset", options.product);
    } catch (retryErr) {
      try {
        await releaseHungPort(options.port, current.transport);
      } catch (releaseErr) {
        if (retryErr instanceof ChipMismatchError) throw retryErr;
        throw releaseErr;
      }
      if (retryErr instanceof ChipMismatchError) throw retryErr;
      const detail = retryErr instanceof Error ? retryErr.message : "unknown";
      throw new Error(
        `Failed to initialize. Hold BOOT, tap RESET, and click Install again. (${detail})`,
      );
    }
  }
  if (!detected) {
    try {
      await releaseHungPort(options.port, current.transport);
    } catch {
      /* the refusal below is the point */
    }
    throw new Error("The chip did not identify itself. The write was aborted.");
  }
  logging = false;
  options.onLog?.(`— connected: ${detected} —`);
  const esploader = current.esploader;
  const transport = current.transport;

  options.onProgress({ message: "Downloading firmware…", percent: null });
  let fileArray: { data: Uint8Array; address: number }[];
  try {
    fileArray = await fetchFirmwareParts(options.status.partUrls);
  } catch (err) {
    try {
      await releaseHungPort(options.port, transport);
    } catch {
      /* keep the download error */
    }
    throw err;
  }

  const totalSize = fileArray.reduce((sum, file) => sum + file.data.length, 0);
  let finished = 0;

  options.onProgress({ message: "Writing firmware…", percent: 0 });
  try {
    await esploader.writeFlash({
      fileArray,
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const fileSize = fileArray[fileIndex]?.data.length ?? 0;
        const uncompressed = total > 0 ? (written / total) * fileSize : 0;
        const percent = Math.min(
          99,
          Math.floor(((finished + uncompressed) / totalSize) * 100),
        );
        options.onProgress({
          message: `Writing firmware… ${percent}%`,
          percent,
        });
        if (written === total) finished += fileSize;
      },
    });
  } catch (err) {
    try {
      await releaseHungPort(options.port, transport);
    } catch {
      /* keep the write error */
    }
    const detail = err instanceof Error ? err.message : "write failed";
    throw new Error(`Flash failed: ${detail}`);
  }

  options.onProgress({
    message: "Flash finished. Press RESET on the board.",
    percent: 100,
  });
  try {
    await releaseHungPort(options.port, transport);
  } catch {
    /* the bytes are already written */
  }
  return detected;
}
