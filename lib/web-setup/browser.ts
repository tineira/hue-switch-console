export function hasWebSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function isPhoneViewport(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android.+Mobile/i.test(navigator.userAgent);
}

/** Desktop Linux, where serial ports need the user in the tty's group (uucp or dialout). */
export function isDesktopLinux(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Linux/i.test(navigator.userAgent) && !/Android|CrOS/i.test(navigator.userAgent);
}

export function webSerialBlockedReason(): string | null {
  if (isPhoneViewport()) return "Use Chrome or Edge on a computer";
  if (!hasWebSerial()) return "Use Chrome or Edge on a computer";
  return null;
}
