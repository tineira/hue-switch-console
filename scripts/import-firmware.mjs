// Copies a released firmware from another console to this one (docs/specs/self-hosting.md §2.3), so a
// self-hosted console can install firmware without building it.
//
//   node scripts/import-firmware.mjs <round|simple> [--from https://hue.tineira.com] [--version x.y.z]
//
// Reads /firmware/<product>/manifest.json (or the --version you name), the four parts and
// /firmware/<product>/<version>/notes from the source, checks each part, and uploads them to this
// console with POST /api/firmware/<product>. Needs FIRMWARE_UPLOAD_TOKEN (this console's);
// CONSOLE_URL defaults to http://localhost:3000. The release waits in /admin until an admin makes
// it current.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PARTS = ["bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin"];
export const DEFAULT_SOURCE = "https://hue.tineira.com";
const USAGE =
  "usage: node scripts/import-firmware.mjs <round|simple> [--from https://hue.tineira.com] [--version x.y.z]";

/** Parses the command line; returns { error } for anything unusable. */
export function parseArgs(argv) {
  const opts = { product: null, from: DEFAULT_SOURCE, version: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from" || a === "--version") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { error: `${a} needs a value` };
      opts[a.slice(2)] = value;
      i++;
    } else if (a.startsWith("--")) {
      return { error: `unknown option ${a}` };
    } else if (!opts.product) {
      opts.product = a;
    } else {
      return { error: `unexpected argument ${a}` };
    }
  }
  if (opts.product !== "round" && opts.product !== "simple") return { error: USAGE };
  if (opts.version !== null && !/^\d+\.\d+\.\d+$/.test(opts.version)) {
    return { error: "--version must look like 1.2.3" };
  }
  try {
    const url = new URL(opts.from);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    opts.from = url.origin;
  } catch {
    return { error: "--from must be an http:// or https:// URL" };
  }
  return opts;
}

/**
 * The version to import and the URL of each part. With no --version, the manifest's version, and
 * every part path must sit under it (the check the spec asks for: parts belong to that version).
 */
export function planImport({ from, product, version, manifest }) {
  const release = version ?? manifest?.version;
  if (typeof release !== "string" || !/^\d+\.\d+\.\d+$/.test(release)) {
    return { error: "the source manifest has no valid version" };
  }
  if (!version) {
    const paths = (manifest?.builds?.[0]?.parts ?? []).map((part) => part?.path);
    for (const name of PARTS) {
      if (!paths.includes(`${release}/${name}`)) {
        return { error: `the source manifest does not list ${release}/${name}` };
      }
    }
  }
  const base = `${from}/firmware/${product}/${release}`;
  return {
    version: release,
    notesUrl: `${base}/notes`,
    parts: PARTS.map((name) => ({ name, url: `${base}/${name}` })),
  };
}

/** Problem with a downloaded part, or null. The source sends each part's SHA-256 as its ETag. */
export function checkPart(name, bytes, etag) {
  if (!bytes || bytes.length === 0) return `${name} is empty`;
  const expected = etag?.replace(/^W\//, "").replace(/"/g, "").toLowerCase();
  if (expected && /^[0-9a-f]{64}$/.test(expected)) {
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected) return `${name} does not match its checksum`;
  }
  return null;
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.error) {
    console.error(opts.error);
    process.exit(1);
  }
  const token = process.env.FIRMWARE_UPLOAD_TOKEN?.trim();
  if (!token) {
    console.error("FIRMWARE_UPLOAD_TOKEN is not set (this console's upload token)");
    process.exit(1);
  }
  const to = (process.env.CONSOLE_URL || "http://localhost:3000").replace(/\/+$/, "");

  const manifest = opts.version
    ? null
    : await getJson(`${opts.from}/firmware/${opts.product}/manifest.json`);
  const plan = planImport({ ...opts, manifest });
  if (plan.error) {
    console.error(plan.error);
    process.exit(1);
  }
  console.log(`Importing ${opts.product} ${plan.version} from ${opts.from} to ${to}`);

  const release = await getJson(plan.notesUrl);
  if (typeof release.notes !== "string" || !release.notes.trim()) {
    console.error(`${plan.notesUrl} has no notes`);
    process.exit(1);
  }

  const form = new FormData();
  form.set("version", plan.version);
  form.set("notes", release.notes);
  if (Array.isArray(release.credits)) form.set("credits", JSON.stringify(release.credits));
  for (const part of plan.parts) {
    const res = await fetch(part.url);
    if (!res.ok) {
      console.error(`${part.url} answered ${res.status}`);
      process.exit(1);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const problem = checkPart(part.name, bytes, res.headers.get("etag"));
    if (problem) {
      console.error(problem);
      process.exit(1);
    }
    console.log(`  ${part.name}: ${bytes.length} bytes`);
    form.set(part.name, new Blob([bytes]), part.name);
  }

  const res = await fetch(`${to}/api/firmware/${opts.product}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  console.log(res.status, await res.text());
  if (res.ok) console.log("Stored. Make it current in /admin → Firmware.");
  process.exit(res.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
