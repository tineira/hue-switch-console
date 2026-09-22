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

async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Connect and read the ROM chip name, then reset back to the sketch.
 * Unknown USB ids skip the classic reset. C6 and S3 on USB Serial/JTAG need
 * the JTAG sequence. A board already held in the bootloader is tried next.
 */
export async function readChipName(port: SerialPort): Promise<string> {
  const modes = ["usb_reset", "no_reset", "default_reset"] as const;
  let last = "the chip did not answer";
  for (const mode of modes) {
    const { ESPLoader, Transport } = await import("esptool-js");
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
    try {
      const name = await withTimeout(
        (async () => {
          await esploader.connect(mode, 3);
          return String(esploader.chip?.CHIP_NAME ?? "");
        })(),
        12000,
        "Chip detection timed out",
      );
      if (name) return name;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    } finally {
      await withTimeout(hardReset(transport, esploader), 3000, "reset timed out").catch(
        () => undefined,
      );
    }
  }
  throw new Error(`Failed to initialize. ${last}`);
}

export async function flashProduct(options: {
  port: SerialPort;
  product: ProductSpec;
  status: ManifestStatus;
  onProgress: (progress: FlashProgress) => void;
}): Promise<string> {
  const { ESPLoader, Transport } = await import("esptool-js");
  const transport = new Transport(options.port, false);
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

  options.onProgress({ message: "Detecting chip…", percent: null });
  try {
    await esploader.main();
    await esploader.flashId();
  } catch (err) {
    await hardReset(transport, esploader);
    const detail = err instanceof Error ? err.message : "unknown";
    throw new Error(
      `Failed to initialize. Hold BOOT if this is the first flash. (${detail})`,
    );
  }

  const detected = String(esploader.chip?.CHIP_NAME ?? "");
  if (!chipFamilyMatches(detected, options.product.chipFamily)) {
    await hardReset(transport, esploader);
    throw new ChipMismatchError(
      options.product.chipFamily,
      detected || "unknown",
      options.product.mismatch,
    );
  }

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
