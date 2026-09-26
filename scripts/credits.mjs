// Writes lib/generated/console-credits.json: the open-source software the console is built on
// (docs/specs/credits.md §2.3). Runs as `prebuild`; rerun by hand after changing dependencies.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "lib", "generated", "console-credits.json");

// devDependencies that end up in what the console ships, not only in the tooling around it.
const SHIPPED_DEV = ["tailwindcss", "typescript"];

// Loaded through next/font/google, not npm.
const EXTRA = [
  { name: "Geist and Geist Mono", version: "Google Fonts", license: "OFL-1.1", url: "https://vercel.com/font" },
];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function repoUrl(pkg) {
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const url = pkg.homepage || repo || `https://www.npmjs.com/package/${pkg.name}`;
  return url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git(#.*)?$/, "");
}

const pkg = readJson(path.join(root, "package.json"));
const names = [...Object.keys(pkg.dependencies ?? {}), ...SHIPPED_DEV];

const problems = [];
const entries = names.map((name) => {
  const dep = readJson(path.join(root, "node_modules", name, "package.json"));
  const license = typeof dep.license === "string" ? dep.license : dep.license?.type;
  if (!license) problems.push(`${name} has no license field`);
  return { name, version: dep.version, license: license ?? "", url: repoUrl(dep) };
});

if (problems.length) {
  console.error(`credits: ${problems.join("; ")}. Decide what to credit and add it to EXTRA.`);
  process.exit(1);
}

const credits = [...entries, ...EXTRA].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(out, `${JSON.stringify(credits, null, 2)}\n`);
console.log(`credits: ${credits.length} entries → ${path.relative(root, out)}`);
