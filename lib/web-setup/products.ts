import { formatMac } from "@/lib/mac";

export type ProductId = "round" | "simple";

export type ProductSpec = {
  id: ProductId;
  label: string;
  board: string;
  chipFamily: "ESP32-S3" | "ESP32-C6";
  mismatch: string;
  manifestPath: string;
};

export const PRODUCTS: Record<ProductId, ProductSpec> = {
  round: {
    id: "round",
    label: "Round Display",
    board: "XIAO ESP32-S3",
    chipFamily: "ESP32-S3",
    mismatch: "This USB device is not a Round Display",
    manifestPath: "/firmware/round/manifest.json",
  },
  simple: {
    id: "simple",
    label: "Simple",
    board: "XIAO ESP32-C6",
    chipFamily: "ESP32-C6",
    mismatch: "This USB device is not a simple switch",
    manifestPath: "/firmware/simple/manifest.json",
  },
};

// Names the key after the board when Setup knows it, so API keys reads as a list of boards.
export function usbKeyName({
  mac,
  productId,
  at = new Date(),
}: {
  mac?: string | null;
  productId?: ProductId | null;
  at?: Date;
} = {}): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const when = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const board = [productId ? PRODUCTS[productId].label : null, mac ? formatMac(mac) : null]
    .filter(Boolean)
    .join(" ");
  return board ? `${board} · ${when}` : `USB ${when}`;
}

export function chipFamilyMatches(detected: string, expected: string): boolean {
  const norm = (value: string) =>
    value.replace(/[\s_]+/g, "-").replace(/-+/g, "-").toUpperCase();
  const a = norm(detected);
  const b = norm(expected);
  if (a === b) return true;
  return a.replaceAll("-", "") === b.replaceAll("-", "");
}

// A name usbKeyName made: "USB <when>" or "<board> · <when>". API keys hides it next to the
// board it names, since the board column already says the same.
export function isSetupKeyName(name: string): boolean {
  return /^(USB |.+ · )\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(name);
}
