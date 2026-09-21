import { BytePort, sleep } from "@/lib/web-setup/serial";

const HEADER = new TextEncoder().encode("IMPROV");
const VERSION = 1;

export const IMPROV_RPC = 0x03;
export const IMPROV_CURRENT_STATE = 0x01;
export const IMPROV_ERROR_STATE = 0x02;
export const IMPROV_RPC_RESULT = 0x04;

export const RPC_WIFI = 0x01;
export const RPC_CURRENT_STATE = 0x02;
export const RPC_SCAN = 0x04;

export const STATE_READY = 0x02;
export const STATE_PROVISIONING = 0x03;
export const STATE_PROVISIONED = 0x04;

export const ERR_UNABLE_TO_CONNECT = 0x03;
export const ERR_UNKNOWN_RPC = 0x02;

export type ImprovPacket = {
  type: number;
  data: Uint8Array;
};

export type WifiNetwork = {
  ssid: string;
  rssi: string;
  auth: string;
};

export type ImprovLog = (line: string) => void;

export type ScanResult = {
  networks: WifiNetwork[];
  ping: number | null;
  /** True when firmware sent the empty RPC_SCAN terminator. */
  finished: boolean;
};

export const PING_MISS_COPY =
  "No Improv reply. This COM may not be the app CDC, or the device is still in setup(). Select USB Serial/JTAG, wait a few seconds, then Scan again. You can still type the SSID.";

export function encodeImprovPacket(type: number, data: Uint8Array): Uint8Array {
  const packet = new Uint8Array(9 + data.length + 1);
  packet.set(HEADER, 0);
  packet[6] = VERSION;
  packet[7] = type;
  packet[8] = data.length;
  packet.set(data, 9);
  let sum = 0;
  for (let i = 0; i < packet.length - 1; i++) sum += packet[i];
  packet[packet.length - 1] = sum & 0xff;
  const framed = new Uint8Array(packet.length + 1);
  framed.set(packet, 0);
  framed[framed.length - 1] = 0x0a;
  return framed;
}

export function encodeRpc(command: number, data: Uint8Array = new Uint8Array()): Uint8Array {
  const payload = new Uint8Array(2 + data.length);
  payload[0] = command;
  payload[1] = data.length;
  payload.set(data, 2);
  return encodeImprovPacket(IMPROV_RPC, payload);
}

export function encodeWifiSettings(ssid: string, password: string): Uint8Array {
  const ssidBytes = new TextEncoder().encode(ssid);
  const passBytes = new TextEncoder().encode(password);
  const data = new Uint8Array(2 + ssidBytes.length + passBytes.length);
  data[0] = ssidBytes.length;
  data.set(ssidBytes, 1);
  data[1 + ssidBytes.length] = passBytes.length;
  data.set(passBytes, 2 + ssidBytes.length);
  return encodeRpc(RPC_WIFI, data);
}

export function parseRpcStrings(data: Uint8Array): { command: number; strings: string[] } {
  if (data.length < 2) return { command: 0, strings: [] };
  const command = data[0];
  const total = data[1];
  const strings: string[] = [];
  let offset = 2;
  const end = Math.min(data.length, 2 + total);
  const decoder = new TextDecoder();
  while (offset < end) {
    const len = data[offset];
    offset += 1;
    strings.push(decoder.decode(data.slice(offset, offset + len)));
    offset += len;
  }
  return { command, strings };
}

function checksumOk(raw: Uint8Array): boolean {
  let sum = 0;
  for (let i = 0; i < raw.length - 1; i++) sum += raw[i];
  return (sum & 0xff) === raw[raw.length - 1];
}

export function extractImprovPacket(
  buffer: Uint8Array,
): { packet: ImprovPacket | null; consumed: number } | null {
  const header = indexOfHeader(buffer);
  if (header < 0) {
    if (buffer.length > 5) return { packet: null, consumed: buffer.length - 5 };
    return null;
  }
  if (header > 0) return { packet: null, consumed: header };
  if (buffer.length < 9) return null;
  const length = buffer[8];
  const total = 9 + length + 1;
  if (buffer.length < total) return null;
  const raw = buffer.slice(0, total);
  if (buffer[6] !== VERSION || !checksumOk(raw)) {
    return { packet: null, consumed: 1 };
  }
  return {
    packet: { type: buffer[7], data: buffer.slice(9, 9 + length) },
    consumed: total,
  };
}

function indexOfHeader(buffer: Uint8Array): number {
  outer: for (let i = 0; i <= buffer.length - HEADER.length; i++) {
    for (let j = 0; j < HEADER.length; j++) {
      if (buffer[i + j] !== HEADER[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export async function readImprovPacket(
  port: BytePort,
  timeoutMs: number,
): Promise<ImprovPacket | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const extracted = extractImprovPacket(port.peek());
    if (extracted) {
      port.consume(extracted.consumed);
      if (!extracted.packet) continue;
      const rest = port.peek();
      if (rest.length > 0 && rest[0] === 0x0a) port.consume(1);
      return extracted.packet;
    }
    const got = await port.fill(Math.max(1, timeoutMs - (Date.now() - start)));
    if (!got) return null;
  }
  return null;
}

function describeTx(data: Uint8Array): string {
  const hex = Array.from(data)
    .slice(0, 20)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const more = data.length > 20 ? "…" : "";
  return `TX ${data.length}B ${hex}${more}`;
}

export async function requestCurrentState(
  port: BytePort,
  onLog?: ImprovLog,
): Promise<number | null> {
  const packet = encodeRpc(RPC_CURRENT_STATE);
  onLog?.(`send RPC current-state (USB ping) ${describeTx(packet)} ${port.describeHandle()}`);
  try {
    await port.write(packet);
  } catch {
    onLog?.(`port lost ${port.describeHandle()}`);
    return null;
  }
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const remain = deadline - Date.now();
    if (remain <= 0) break;
    const packet = await readImprovPacket(port, remain);
    if (!packet) {
      if (port.dead) {
        onLog?.(`port lost ${port.describeHandle()}`);
        break;
      }
      onLog?.("silence, still waiting for current-state");
      continue;
    }
    onLog?.(describeImprovPacket(packet));
    if (packet.type === IMPROV_CURRENT_STATE && packet.data.length > 0) {
      return packet.data[0];
    }
  }
  return null;
}

export function describeImprovPacket(packet: ImprovPacket): string {
  if (packet.type === IMPROV_CURRENT_STATE) {
    const st = packet.data[0] ?? 0;
    const name =
      st === STATE_READY
        ? "ready"
        : st === STATE_PROVISIONING
          ? "provisioning"
          : st === STATE_PROVISIONED
            ? "provisioned"
            : `0x${st.toString(16)}`;
    return `state ${name}`;
  }
  if (packet.type === IMPROV_ERROR_STATE) {
    const code = packet.data[0] ?? 0;
    if (code === 0) return "ack (error none)";
    return `error 0x${code.toString(16)}`;
  }
  if (packet.type === IMPROV_RPC_RESULT) {
    const { command, strings } = parseRpcStrings(packet.data);
    const cmd =
      command === RPC_SCAN
        ? "scan"
        : command === RPC_WIFI
          ? "wifi"
          : command === RPC_CURRENT_STATE
            ? "current-state"
            : `0x${command.toString(16)}`;
    if (strings.length === 0) return `rpc-result ${cmd} empty`;
    return `rpc-result ${cmd} ${strings.join(" | ")}`;
  }
  return `type=0x${packet.type.toString(16)} len=${packet.data.length}`;
}

export async function scanNetworks(
  port: BytePort,
  onLog?: ImprovLog,
  onPing?: (state: number | null) => void,
): Promise<ScanResult> {
  const t0 = Date.now();
  const log = (line: string) => onLog?.(`+${Date.now() - t0}ms  ${line}`);
  let ping = await requestCurrentState(port, log);
  if (ping == null) {
    log("no state reply — reopening USB (no DTR/RTS pulse)");
    try {
      await port.reopen();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "reopen failed";
      log(`port lost (${detail}) ${port.describeHandle()}`);
      onPing?.(null);
      return { networks: [], ping: null, finished: false };
    }
    ping = await requestCurrentState(port, log);
  }
  if (ping == null) {
    log(
      `no state reply after reopen — sending scan 0x04 anyway ${port.describeHandle()}`,
    );
  }
  onPing?.(ping);
  const scanPkt = encodeRpc(RPC_SCAN);
  log(`send RPC scan 0x04 ${describeTx(scanPkt)} ${port.describeHandle()}`);
  try {
    await port.write(scanPkt);
  } catch {
    log(`port lost ${port.describeHandle()}`);
    return { networks: [], ping, finished: false };
  }
  const networks: WifiNetwork[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const remain = deadline - Date.now();
    if (remain <= 0) break;
    const packet = await readImprovPacket(port, Math.min(3000, remain));
    if (!packet) {
      if (port.dead) {
        log(`port lost ${port.describeHandle()}`);
        break;
      }
      log(`silence ${Date.now() - t0}ms, still waiting… ${port.describeHandle()}`);
      continue;
    }
    log(describeImprovPacket(packet));
    if (packet.type === IMPROV_ERROR_STATE && packet.data[0] === ERR_UNKNOWN_RPC) {
      throw new Error("This firmware does not support Wi-Fi scan. Enter the SSID manually.");
    }
    if (packet.type !== IMPROV_RPC_RESULT) continue;
    const { command, strings } = parseRpcStrings(packet.data);
    if (command !== RPC_SCAN) continue;
    if (strings.length === 0) {
      log(`scan finished, ${networks.length} network(s)`);
      return { networks, ping, finished: true };
    }
    for (let i = 0; i + 2 < strings.length; i += 3) {
      const ssid = strings[i];
      if (!ssid || seen.has(ssid)) continue;
      seen.add(ssid);
      networks.push({ ssid, rssi: strings[i + 1], auth: strings[i + 2] });
    }
  }
  log(`loop ended in silence, ${networks.length} network(s)`);
  return { networks, ping, finished: false };
}

export async function provisionWifi(
  port: BytePort,
  ssid: string,
  password: string,
): Promise<void> {
  await port.write(encodeWifiSettings(ssid, password));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const packet = await readImprovPacket(port, Math.min(4000, deadline - Date.now()));
    if (!packet) {
      await sleep(50);
      continue;
    }
    if (packet.type === IMPROV_ERROR_STATE) {
      const code = packet.data[0] ?? 0xff;
      if (code === ERR_UNABLE_TO_CONNECT) {
        throw new Error("Unable to connect. Check the SSID and password (2.4 GHz).");
      }
      if (code === 0) continue;
      throw new Error(`Improv error 0x${code.toString(16)}`);
    }
    if (packet.type === IMPROV_CURRENT_STATE) {
      const state = packet.data[0];
      if (state === STATE_PROVISIONED) return;
    }
  }
  throw new Error("Timed out waiting for Improv provisioned");
}
