// Uploads a local build to the console, the same way firmware CI does (docs/specs/firmware-uploads.md).
//
//   node scripts/upload-firmware.mjs <round|simple> <dir> --version 0.5.28 --notes <file>
//
// <dir> holds bootloader.bin, partitions.bin, boot_app0.bin and firmware.bin. Without --version,
// <dir>/manifest.json supplies it. --notes is a markdown file with that version's changelog bullets.
// Needs FIRMWARE_UPLOAD_TOKEN; CONSOLE_URL defaults to https://hue.tineira.com.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PARTS = ["bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin"];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const [product, dir] = process.argv.slice(2);
if (!["round", "simple"].includes(product) || !dir) {
  console.error("usage: node scripts/upload-firmware.mjs <round|simple> <dir> [--version x.y.z] --notes <file>");
  process.exit(1);
}

const token = process.env.FIRMWARE_UPLOAD_TOKEN;
if (!token) {
  console.error("FIRMWARE_UPLOAD_TOKEN is not set");
  process.exit(1);
}

let version = arg("version");
const manifestFile = path.join(dir, "manifest.json");
if (!version && existsSync(manifestFile)) {
  version = JSON.parse(readFileSync(manifestFile, "utf8")).version;
}
if (!version) {
  console.error("No --version and no manifest.json in the directory");
  process.exit(1);
}

const notesFile = arg("notes");
if (!notesFile) {
  console.error("--notes <file> is required: a release must have changelog notes");
  process.exit(1);
}

const form = new FormData();
form.set("version", version);
form.set("notes", readFileSync(notesFile, "utf8"));
const commit = arg("commit");
if (commit) form.set("commit", commit);
for (const name of PARTS) {
  form.set(name, new Blob([readFileSync(path.join(dir, name))]), name);
}

const base = process.env.CONSOLE_URL || "https://hue.tineira.com";
const res = await fetch(`${base}/api/firmware/${product}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
