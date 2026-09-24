import {
  parseHuestaLine,
  type Huesta,
} from "@/lib/web-setup/devices";
import { BytePort } from "@/lib/web-setup/serial";

export type HueLog = (line: string) => void;

function discard(port: BytePort) {
  const pending = port.peek().length;
  if (pending) port.consume(pending);
}

/** First line that starts with HUE. Other bytes are ignored until the deadline. */
async function nextHueLine(
  port: BytePort,
  timeoutMs: number,
  onLog?: HueLog,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remain = deadline - Date.now();
    if (remain <= 0) break;
    const line = await port.readLine(Math.min(1500, remain));
    if (line == null) {
      if (port.dead) return null;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith("HUE")) continue;
    onLog?.(`RX ${trimmed.slice(0, 300)}`);
    return trimmed;
  }
  return null;
}

export async function hueGet(
  port: BytePort,
  timeoutMs = 6000,
  onLog?: HueLog,
): Promise<Huesta | null> {
  discard(port);
  onLog?.("TX HUEGET");
  await port.writeLine("HUEGET");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const line = await nextHueLine(port, deadline - Date.now(), onLog);
    if (line == null) return null;
    if (line.startsWith("HUEERR")) return null;
    if (line.startsWith("HUESTA")) return parseHuestaLine(line);
  }
  return null;
}

/**
 * Improv can answer while the board is still inside a Hue request and not
 * reading USB. Keep asking until the stored-card line shows up.
 */
export async function hueGetSettled(
  port: BytePort,
  onLog?: HueLog,
  extraMs = 20000,
): Promise<Huesta | null> {
  const first = await hueGet(port, 6000, onLog);
  if (first || port.dead) return first;
  const deadline = Date.now() + extraMs;
  while (Date.now() < deadline) {
    if (port.dead) return null;
    const remain = deadline - Date.now();
    const card = await hueGet(port, Math.min(6000, remain), onLog);
    if (card) return card;
  }
  return null;
}

/** Immediate ack only. The board's 90s button wait is not held open here. */
export async function huePair(
  port: BytePort,
  onLog?: HueLog,
): Promise<"ok" | "no-wifi"> {
  discard(port);
  onLog?.("TX HUEPAIR");
  await port.writeLine("HUEPAIR");
  const line = await nextHueLine(port, 8000, onLog);
  if (line === "HUEOK pair") return "ok";
  if (line != null && line.startsWith("HUEERR") && line.includes("no-wifi")) {
    return "no-wifi";
  }
  if (!line) throw new Error("Timed out waiting for HUEPAIR");
  throw new Error(line);
}

export async function hueClear(port: BytePort, onLog?: HueLog): Promise<void> {
  discard(port);
  onLog?.("TX HUECLR");
  await port.writeLine("HUECLR");
  const line = await nextHueLine(port, 8000, onLog);
  if (line === "HUEOK clear") return;
  if (!line) throw new Error("Timed out waiting for HUEOK clear");
  throw new Error(line);
}

/**
 * Asks the Simple to restart into its ROM download mode (docs/specs/usb-download-mode.md).
 * Firmware before Simple 0.2.11 answers HUEERR unknown; the caller then asks for BOOT+RESET.
 */
export async function hueBoot(
  port: BytePort,
  onLog?: HueLog,
): Promise<"ok" | "unknown" | "timeout"> {
  discard(port);
  onLog?.("TX HUEBOOT");
  await port.writeLine("HUEBOOT");
  const line = await nextHueLine(port, 1500, onLog);
  if (line === "HUEOK boot") return "ok";
  if (!line) return "timeout";
  return "unknown";
}
