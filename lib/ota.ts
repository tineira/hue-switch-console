// OTA updates (docs/specs/ota.md; Round: docs/specs/ota-round.md). Pure helpers, safe on the client.

import { compareVersions } from "@/lib/web-setup/devices";

/** The first Simple release with an OTA client that sends `firmware` on every poll. */
export const SIMPLE_OTA_MIN_FIRMWARE = "0.6.0";
/** The first Round release with an OTA client (docs/specs/ota-round.md §4.1). */
export const ROUND_OTA_MIN_FIRMWARE = "0.6.0";

export type OtaStatus = "current" | "behind" | "offered" | "failed" | "ahead" | "unknown";

/** The `firmware` query parameter; null when missing or not `major.minor.patch`. */
export function parseReportedFirmware(raw: string | null): string | null {
  if (raw === null) return null;
  const value = raw.trim();
  return /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value) ? value : null;
}

/** The `ota_error` query parameter. Unknown codes are kept for logs (§2.1). */
export function parseOtaError(raw: string | null): string | null {
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  return /^[a-z0-9_]{1,32}$/.test(value) ? value : null;
}

export function otaCapable(row: { product: string; firmware: string | null }): boolean {
  const min =
    row.product === "simple"
      ? SIMPLE_OTA_MIN_FIRMWARE
      : row.product === "round"
        ? ROUND_OTA_MIN_FIRMWARE
        : null;
  if (!min) return false;
  const cmp = compareVersions(row.firmware ?? "", min);
  return cmp === 0 || cmp === 1;
}

/** Badge for a switch against the product's current release (§3.1). `latest` "" = no release. */
export function otaStatus(
  row: {
    firmware: string | null;
    ota_offered_at: string | null;
    ota_error_at: string | null;
  },
  latest: string,
): OtaStatus {
  const cmp = compareVersions(row.firmware ?? "", latest);
  if (cmp === null) return "unknown";
  if (cmp === 0) return "current";
  if (row.ota_offered_at) {
    const failed =
      row.ota_error_at !== null && Date.parse(row.ota_error_at) > Date.parse(row.ota_offered_at);
    return failed ? "failed" : "offered";
  }
  return cmp === -1 ? "behind" : "ahead";
}

/** Readable text for an `ota_error` code. */
export function otaErrorText(code: string | null): string {
  switch (code) {
    case "heap":
      return "not enough memory to start the download";
    case "connect":
      return "could not reach the console";
    case "http":
      return "the console did not serve the image";
    case "size":
      // Also a power cut or restart mid-download (docs/specs/ota.md §6 item 2).
      return "the download was incomplete or the wrong size";
    case "write":
      return "writing the flash failed";
    case "sha":
      return "the downloaded image was corrupted";
    case "boot":
      return "the new firmware did not start, so the switch went back to the old one";
    default:
      return code ? `error ${code}` : "unknown error";
  }
}
