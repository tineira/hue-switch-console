export function normalizeMac(raw: string): string | null {
  const hex = raw.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  return hex.length === 12 ? hex : null;
}

export function formatMac(mac: string): string {
  return mac.replace(/../g, (pair) => `${pair}:`).slice(0, -1);
}
