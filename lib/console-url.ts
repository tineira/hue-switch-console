// Which console a board talks to (docs/specs/self-hosting.md §2.1). Pure: no env, no browser.

/** The hosted console. Only used to tell the hosted deployment apart, never as a default. */
export const HOSTED_CONSOLE_URL = "https://hue.tineira.com";

/** The origin of an `http://` or `https://` URL, or null for anything else. */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The URL Setup writes with `HUESET url`: DEVICE_CONSOLE_URL, else the public URL
 * (BETTER_AUTH_URL), else the origin of the page running Setup.
 */
export function resolveDeviceConsoleUrl({
  deviceConsoleUrl,
  publicUrl,
  pageOrigin,
}: {
  deviceConsoleUrl?: string | null;
  publicUrl?: string | null;
  pageOrigin?: string | null;
}): string | null {
  return (
    normalizeOrigin(deviceConsoleUrl) ?? normalizeOrigin(publicUrl) ?? normalizeOrigin(pageOrigin)
  );
}

/** Host (with a non-default port) of a console URL, lower case; null when it is not one. */
export function consoleHost(raw: string | null | undefined): string | null {
  const origin = normalizeOrigin(raw);
  return origin ? new URL(origin).host.toLowerCase() : null;
}

/** True for loopback hosts, which a board on Wi-Fi can never reach (it would call itself). */
export function isLoopbackConsole(raw: string | null | undefined): boolean {
  const origin = normalizeOrigin(raw);
  if (!origin) return false;
  const host = new URL(origin).hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(host)
  );
}

export type ConsoleMove =
  // The board has no console URL saved.
  | { kind: "unset" }
  // It already talks to this console's host.
  | { kind: "same" }
  // It talks to another host (or holds a value that is not a URL): ask before moving it.
  | { kind: "move"; from: string };

/** Compares the URL a board reported (`HUEGET` `url`) with the one Setup is about to write. */
export function consoleMove(stored: string | null | undefined, target: string | null): ConsoleMove {
  const saved = stored?.trim() ?? "";
  if (!saved) return { kind: "unset" };
  const from = consoleHost(saved);
  const to = consoleHost(target);
  if (from && to && from === to) return { kind: "same" };
  return { kind: "move", from: from ?? saved };
}

/** Question Setup asks before it points a board at this console instead of another one. */
export function moveConfirmText(from: string, target: string): string {
  const to = consoleHost(target) ?? target;
  return `This board was set up for ${from}. Move it to ${to}? It stops talking to ${from} and takes its settings from ${to} from then on.`;
}
