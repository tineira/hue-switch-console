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

async function hardReset(
  transport: {
    setRTS: (level: boolean) => Promise<void>;
    disconnect: () => Promise<void>;
  },
  esploader: { after: (mode?: "hard_reset") => Promise<void> },
) {
  try {
    await transport.setRTS(true);
    await sleep(100);
    await esploader.after("hard_reset");
  } catch {
    try {
      await esploader.after("hard_reset");
    } catch {
      /* reset is best-effort after a failed connect */
    }
  }
  try {
    await transport.disconnect();
  } catch {
    /* already dropped */
  }
}

type ResetMode = "usb_reset" | "no_reset" | "default_reset";

const CONNECT_DEADLINE_MS = 8000;
const PORT_UNLOCK_MS = 2000;

class ConnectTimeoutError extends Error {
  constructor() {
    super("Connecting timed out");
    this.name = "ConnectTimeoutError";
  }
}

function resetModeFor(port: SerialPort): "usb_reset" | "default_reset" {
  // No product id: this is the C6/S3 USB-Serial/JTAG port. Classic reset never syncs.
  return typeof port.getInfo().usbProductId === "number" ? "default_reset" : "usb_reset";
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
    throw new Error("The USB port is still in use. Reload the page and try Install again.");
  }
  try {
    await port.close();
  } catch (err) {
    if (!streamsLocked(port) && err instanceof DOMException && err.name === "InvalidStateError") {
      return;
    }
    throw new Error("The USB port is still in use. Reload the page and try Install again.");
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

async function afterConnect(esploader: EspLoaderType, product: ProductSpec): Promise<string> {
  const detected = String(esploader.chip?.CHIP_NAME ?? "");
  if (detected && !chipFamilyMatches(detected, product.chipFamily)) {
    throw new ChipMismatchError(product.chipFamily, detected, product.mismatch);
  }
  if (!detected) return "";
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
    terminal: { clean: () => void; writeLine: () => void; write: () => void };
  }) => InstanceType<typeof import("esptool-js").ESPLoader>,
  Transport: typeof import("esptool-js").Transport,
) {
  const transport = new Transport(port, false);
  const esploader = new ESPLoader({
    transport,
    baudrate: 115200,
    enableTracing: false,
    terminal: {
      clean() {},
      writeLine() {},
      write() {},
    },
  });
  return { transport, esploader };
}

async function attach(
  esploader: EspLoaderType,
  mode: ResetMode,
  product: ProductSpec,
): Promise<string> {
  await esploader.connect(mode, 2);
  return afterConnect(esploader, product);
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
}): Promise<string> {
  const { ESPLoader, Transport } = await import("esptool-js");
  let current = loaderFor(options.port, ESPLoader, Transport);

  options.onProgress({ message: "Connecting…", percent: null });
  let detected: string;
  try {
    detected = await attachWithin(current.esploader, resetModeFor(options.port), options.product);
  } catch (err) {
    if (err instanceof ChipMismatchError) {
      await hardReset(current.transport, current.esploader);
      throw err;
    }
    if (err instanceof ConnectTimeoutError) {
      await releaseHungPort(options.port, current.transport);
    } else {
      await hardReset(current.transport, current.esploader);
      if (!options.unidentified) {
        const detail = err instanceof Error ? err.message : "unknown";
        throw new Error(`Failed to initialize. Hold BOOT if this is the first flash. (${detail})`);
      }
    }
    current = loaderFor(options.port, ESPLoader, Transport);
    options.onProgress({
      message: "Connecting without reset… hold BOOT.",
      percent: null,
    });
    try {
      detected = await attach(current.esploader, "no_reset", options.product);
    } catch (retryErr) {
      await hardReset(current.transport, current.esploader);
      if (retryErr instanceof ChipMismatchError) throw retryErr;
      const detail = retryErr instanceof Error ? retryErr.message : "unknown";
      throw new Error(
        `Failed to initialize. Hold BOOT, then try Install again. (${detail})`,
      );
    }
  }
  if (!detected) {
    await hardReset(current.transport, current.esploader);
    throw new Error("The chip did not identify itself. The write was aborted.");
  }
  const esploader = current.esploader;
  const transport = current.transport;

  options.onProgress({ message: "Downloading firmware…", percent: null });
  let fileArray: { data: Uint8Array; address: number }[];
  try {
    fileArray = await fetchFirmwareParts(options.status.partUrls);
  } catch (err) {
    await hardReset(transport, esploader);
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
    await hardReset(transport, esploader);
    const detail = err instanceof Error ? err.message : "write failed";
    throw new Error(`Flash failed: ${detail}`);
  }

  options.onProgress({ message: "Resetting device…", percent: 100 });
  await hardReset(transport, esploader);
  return detected;
}
