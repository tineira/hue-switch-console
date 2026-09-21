export type ManifestPart = {
  path: string;
  offset: number;
};

export type ManifestBuild = {
  chipFamily: string;
  parts: ManifestPart[];
};

export type FirmwareManifest = {
  name: string;
  version: string;
  builds: ManifestBuild[];
};

export type ManifestStatus = {
  manifest: FirmwareManifest;
  build: ManifestBuild;
  version: string;
  partUrls: { part: ManifestPart; url: string }[];
  missing: string[];
};

function asParts(value: unknown): ManifestPart[] {
  if (!Array.isArray(value)) return [];
  const parts: ManifestPart[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { path?: unknown; offset?: unknown };
    if (typeof rec.path !== "string" || typeof rec.offset !== "number") continue;
    parts.push({ path: rec.path, offset: rec.offset });
  }
  return parts;
}

export function parseManifest(raw: unknown): FirmwareManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as {
    name?: unknown;
    version?: unknown;
    builds?: unknown;
  };
  if (typeof rec.name !== "string" || typeof rec.version !== "string") return null;
  if (!Array.isArray(rec.builds) || rec.builds.length === 0) return null;
  const builds: ManifestBuild[] = [];
  for (const build of rec.builds) {
    if (!build || typeof build !== "object") continue;
    const b = build as { chipFamily?: unknown; parts?: unknown };
    if (typeof b.chipFamily !== "string") continue;
    const parts = asParts(b.parts);
    if (parts.length === 0) continue;
    builds.push({ chipFamily: b.chipFamily, parts });
  }
  if (builds.length === 0) return null;
  return { name: rec.name, version: rec.version, builds };
}

export function resolvePartUrl(manifestPath: string, partPath: string): string {
  return new URL(partPath, new URL(manifestPath, window.location.href)).href;
}

export async function loadManifestStatus(
  manifestPath: string,
  chipFamily: string,
): Promise<ManifestStatus> {
  const res = await fetch(manifestPath, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load firmware manifest (${res.status})`);
  }
  const manifest = parseManifest(await res.json());
  if (!manifest) {
    throw new Error("Firmware manifest is invalid");
  }
  const build = manifest.builds.find((item) => item.chipFamily === chipFamily);
  if (!build) {
    throw new Error(`Manifest has no build for ${chipFamily}`);
  }
  const partUrls = build.parts.map((part) => ({
    part,
    url: resolvePartUrl(manifestPath, part.path),
  }));
  const missing: string[] = [];
  await Promise.all(
    partUrls.map(async ({ part, url }) => {
      try {
        const probe = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (probe.ok) return;
        if (probe.status === 405 || probe.status === 501) {
          const get = await fetch(url, { method: "GET", cache: "no-store" });
          if (get.ok) return;
        }
        missing.push(part.path);
      } catch {
        missing.push(part.path);
      }
    }),
  );
  return {
    manifest,
    build,
    version: manifest.version,
    partUrls,
    missing,
  };
}

export async function fetchFirmwareParts(
  partUrls: ManifestStatus["partUrls"],
): Promise<{ data: Uint8Array; address: number }[]> {
  const files: { data: Uint8Array; address: number }[] = [];
  for (const { part, url } of partUrls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Firmware image missing: ${part.path}`);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error(`Firmware image empty: ${part.path}`);
    }
    files.push({
      data: new Uint8Array(buffer),
      address: part.offset,
    });
  }
  return files;
}
