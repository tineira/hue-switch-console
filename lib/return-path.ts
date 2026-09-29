// Where sign-in sends the person afterwards (docs/specs/finished/public-how-to-changelog.md, D2 (c)).
// Only a path on this site is accepted, so `?next=` can never send anyone to another origin.

/** Request header that proxy.ts sets to the page's path and query; never trusted from the browser. */
export const PATH_HEADER = "x-hsw-path";

const BASE = "http://return-path.invalid";

/** `raw` if it is a same-site path worth returning to, else "/". */
export function safeReturnPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return "/";
  // A path, not a scheme-relative URL (//host) or a backslash trick (/\host) browsers normalise.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  // Control characters (tabs and newlines are stripped by URL parsers).
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  // Returning to sign-in, or to an API route, is never what the person wanted.
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return "/";
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/login`, carrying `next` when it is somewhere other than the home page. */
export function loginHref(next: string | null | undefined): string {
  const path = safeReturnPath(next);
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
}
