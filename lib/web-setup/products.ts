export const PRODUCT_CONSOLE_URL = "https://hue.tineira.com";

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

export function usbKeyName(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `USB ${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function chipFamilyMatches(detected: string, expected: string): boolean {
  const norm = (value: string) =>
    value.replace(/[\s_]+/g, "-").replace(/-+/g, "-").toUpperCase();
  const a = norm(detected);
  const b = norm(expected);
  if (a === b) return true;
  return a.replaceAll("-", "") === b.replaceAll("-", "");
}
