// Pure Devices card rules: USB id, HUESTA percent-decoding, and which buttons are on.
// No browser, serial, or network.

export type UsbKind = "c6" | "s3" | "s3-plus" | "c5" | "bootloader" | "other";

export type BoardChoice = "c6" | "s3";

export type ProductChoice = "simple" | "round";

export type ChipChoice = "c6" | "s3";

export type UsbIdentity = {
  vendorId: number | null;
  productId: number | null;
  kind: UsbKind;
  /** Uppercase vendor:product, or "Unknown" when the browser has no ids. */
  idText: string;
  title: string;
};

export type Huesta = {
  mac: string;
  product: ProductChoice;
  ver: string;
  chip: ChipChoice;
  ssid: string;
  wifi: "up" | "down";
  ip: string;
  bid: string;
  bip: string;
  url: string;
  token: boolean;
  key: boolean;
};

export type ImprovSeen = {
  name: string;
  version: string;
  hardware: string;
  deviceName: string;
  product: ProductChoice | null;
  chip: ChipChoice | null;
};

export type FlashAction = "none" | "install" | "update" | "reinstall";

export type DeviceActions = {
  unsupported: boolean;
  cross: boolean;
  askBoard: boolean;
  flash: FlashAction;
  wifi: boolean;
  token: boolean;
  pair: boolean;
  clear: boolean;
  showSaved: boolean;
};

export const HUESTA_KEYS = [
  "mac",
  "product",
  "ver",
  "chip",
  "ssid",
  "wifi",
  "ip",
  "bid",
  "bip",
  "url",
  "token",
  "key",
] as const;

const SEEED_VID = 0x2886;
const ESPRESSIF_VID = 0x303a;
const PID_C6 = 0x0048;
const PID_S3 = 0x0056;
const PID_S3_PLUS = 0x0063;
const PID_C5 = 0x0067;
const PID_BOOTLOADER = 0x1001;

const NO_ACTIONS: DeviceActions = {
  unsupported: false,
  cross: false,
  askBoard: false,
  flash: "none",
  wifi: false,
  token: false,
  pair: false,
  clear: false,
  showSaved: false,
};

function hexId(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

export function identifyUsb(vendorId?: number, productId?: number): UsbIdentity {
  if (typeof vendorId !== "number" || typeof productId !== "number") {
    return {
      vendorId: null,
      productId: null,
      kind: "other",
      idText: "Unknown",
      title: "Not a supported board",
    };
  }
  const idText = `${hexId(vendorId)}:${hexId(productId)}`;
  const base = { vendorId, productId, idText };
  if (vendorId === SEEED_VID && productId === PID_C6) {
    return { ...base, kind: "c6", title: "XIAO ESP32-C6" };
  }
  if (vendorId === SEEED_VID && productId === PID_S3) {
    return { ...base, kind: "s3", title: "XIAO ESP32-S3" };
  }
  if (vendorId === SEEED_VID && productId === PID_S3_PLUS) {
    return { ...base, kind: "s3-plus", title: "XIAO ESP32-S3 Plus" };
  }
  if (vendorId === SEEED_VID && productId === PID_C5) {
    return { ...base, kind: "c5", title: "XIAO ESP32-C5" };
  }
  if (vendorId === ESPRESSIF_VID && productId === PID_BOOTLOADER) {
    return { ...base, kind: "bootloader", title: "Bootloader" };
  }
  return { ...base, kind: "other", title: "Not a supported board" };
}

export function productForBoard(board: BoardChoice | UsbKind): ProductChoice | null {
  if (board === "c6") return "simple";
  if (board === "s3") return "round";
  return null;
}

/** Chip named by the sketch. HUESTA wins over Improv. Null when neither answered. */
export function sketchTitle(chip: ChipChoice | null): string | null {
  if (chip === "c6") return "XIAO ESP32-C6";
  if (chip === "s3") return "XIAO ESP32-S3";
  return null;
}

export function learnedChip(
  improv: ImprovSeen | null,
  huesta: Huesta | null,
): ChipChoice | null {
  if (huesta) return huesta.chip;
  return improv?.chip ?? null;
}

export function flashProductFor(input: {
  usbKind: UsbKind;
  boardChoice: BoardChoice | null;
  improv: ImprovSeen | null;
  huesta: Huesta | null;
}): ProductChoice | null {
  if (input.usbKind === "c6" || input.usbKind === "s3") {
    return productForBoard(input.usbKind);
  }
  if (input.usbKind === "bootloader") {
    const chip = learnedChip(input.improv, input.huesta);
    if (chip) return productForBoard(chip);
    if (input.boardChoice) return productForBoard(input.boardChoice);
  }
  return null;
}

/** Receiver rule: split on spaces and the first "=", then decode %HH. A broken % sequence is rejected. */
export function decodeHueValue(raw: string): string | null {
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "%") {
      if (i + 2 >= raw.length) return null;
      const hex = raw.slice(i + 1, i + 3);
      if (!/^[0-9A-F]{2}$/.test(hex)) return null;
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code > 0x7e) return null;
    bytes.push(code);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

export function parseHuestaLine(line: string): Huesta | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("HUESTA ")) return null;
  const fields = trimmed.slice("HUESTA ".length).split(" ");
  if (fields.length !== HUESTA_KEYS.length) return null;
  const raw: Record<(typeof HUESTA_KEYS)[number], string> = {
    mac: "",
    product: "",
    ver: "",
    chip: "",
    ssid: "",
    wifi: "",
    ip: "",
    bid: "",
    bip: "",
    url: "",
    token: "",
    key: "",
  };
  for (let i = 0; i < HUESTA_KEYS.length; i++) {
    const field = fields[i];
    const eq = field.indexOf("=");
    if (eq <= 0) return null;
    const key = field.slice(0, eq);
    if (key !== HUESTA_KEYS[i]) return null;
    const value = decodeHueValue(field.slice(eq + 1));
    if (value == null) return null;
    raw[HUESTA_KEYS[i]] = value;
  }
  if (raw.mac !== "" && !/^[0-9a-f]{12}$/.test(raw.mac)) return null;
  const product = raw.product;
  const chip = raw.chip;
  const wifi = raw.wifi;
  if (product !== "simple" && product !== "round") return null;
  if (chip !== "c6" && chip !== "s3") return null;
  if (wifi !== "up" && wifi !== "down") return null;
  if (raw.token !== "0" && raw.token !== "1") return null;
  if (raw.key !== "0" && raw.key !== "1") return null;
  return {
    mac: raw.mac,
    product,
    ver: raw.ver,
    chip,
    ssid: raw.ssid,
    wifi,
    ip: raw.ip,
    bid: raw.bid,
    bip: raw.bip,
    url: raw.url,
    token: raw.token === "1",
    key: raw.key === "1",
  };
}

export function compareVersions(device: string, manifest: string): -1 | 0 | 1 | null {
  const parse = (value: string): [number, number, number] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
    if (!match) return null;
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
    if (parts.some((part) => !Number.isSafeInteger(part))) return null;
    return [parts[0], parts[1], parts[2]];
  };
  const left = parse(device);
  const right = parse(manifest);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

export function provisioningDone(card: Huesta): boolean {
  return card.ssid.length > 0 && card.token;
}

function productFromImprov(name: string, deviceName: string): ProductChoice | null {
  const blob = `${name}\n${deviceName}`.toLowerCase();
  const simple = blob.includes("hue-simple") || blob.includes("hue simple");
  const round =
    blob.includes("hue-round") || blob.includes("hue round") || blob.includes("round display");
  if (simple && !round) return "simple";
  if (round && !simple) return "round";
  return null;
}

function chipFromHardware(hardware: string): ChipChoice | null {
  const value = hardware.toLowerCase().replace(/[\s_]+/g, "-");
  const c6 = value.includes("esp32-c6") || value.includes("esp32c6");
  const s3 = value.includes("esp32-s3") || value.includes("esp32s3");
  if (c6 && !s3) return "c6";
  if (s3 && !c6) return "s3";
  return null;
}

export function classifyImprov(info: {
  name: string;
  version: string;
  hardware: string;
  deviceName: string;
}): ImprovSeen | null {
  const name = info.name.trim();
  const version = info.version.trim();
  const hardware = info.hardware.trim();
  const deviceName = info.deviceName.trim();
  if (!name && !version) return null;
  return {
    name,
    version,
    hardware,
    deviceName,
    product: productFromImprov(name, deviceName),
    chip: chipFromHardware(hardware),
  };
}

function flashForVersion(ver: string, manifestVersion: string | null): FlashAction {
  if (!manifestVersion) return "none";
  const cmp = compareVersions(ver, manifestVersion);
  if (cmp === -1) return "update";
  if (cmp === 0) return "reinstall";
  return "none";
}

export function decideActions(input: {
  usbKind: UsbKind;
  boardChoice: BoardChoice | null;
  improv: ImprovSeen | null;
  huesta: Huesta | null;
  manifestVersion: string | null;
}): DeviceActions {
  if (input.usbKind === "s3-plus" || input.usbKind === "c5") {
    return { ...NO_ACTIONS, unsupported: true };
  }
  // Chrome gave no id, or one we do not list. The person can still name the board.
  // Install reads the chip and refuses a mismatch.
  if (input.usbKind === "other") {
    return {
      ...NO_ACTIONS,
      askBoard: true,
      flash: input.boardChoice ? "install" : "none",
    };
  }
  // 303A:1001 is the ROM bootloader and also a running sketch on USB Serial/JTAG
  // (our C6, and Round built with Hardware CDC). The sketch's chip wins when it answers.
  let usbKind = input.usbKind;
  if (usbKind === "bootloader") {
    const chip = learnedChip(input.improv, input.huesta);
    if (!chip) {
      return {
        ...NO_ACTIONS,
        askBoard: true,
        flash: input.boardChoice ? "install" : "none",
      };
    }
    usbKind = chip;
  }

  const expectedProduct = productForBoard(usbKind);
  const expectedChip: ChipChoice | null =
    usbKind === "c6" || usbKind === "s3" ? usbKind : null;
  if (!expectedProduct || !expectedChip) return { ...NO_ACTIONS, unsupported: true };

  const improv = input.improv;
  const huesta = input.huesta;
  const cross =
    (improv?.product != null && improv.product !== expectedProduct) ||
    (improv?.chip != null && improv.chip !== expectedChip) ||
    (huesta != null && (huesta.product !== expectedProduct || huesta.chip !== expectedChip));
  if (cross) {
    return { ...NO_ACTIONS, cross: true, flash: "install" };
  }
  if (!huesta) {
    return { ...NO_ACTIONS, flash: "install", wifi: true };
  }

  const wifiUp = huesta.wifi === "up";
  return {
    unsupported: false,
    cross: false,
    askBoard: false,
    flash: flashForVersion(huesta.ver, input.manifestVersion),
    wifi: true,
    token: wifiUp,
    pair: wifiUp,
    clear: true,
    showSaved: true,
  };
}
