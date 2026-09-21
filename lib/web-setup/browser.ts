export function hasWebSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function isPhoneViewport(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android.+Mobile/i.test(navigator.userAgent);
}

export function webSerialBlockedReason(): string | null {
  if (isPhoneViewport()) return "Use Chrome or Edge on a computer";
  if (!hasWebSerial()) return "Use Chrome or Edge on a computer";
  return null;
}
