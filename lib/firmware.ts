import { createHash } from "node:crypto";
import { sql } from "@/lib/sql";
import { secretMatches } from "@/lib/tokens";
import type { ProductId } from "@/lib/web-setup/products";

// Firmware releases uploaded by firmware CI (docs/specs/finished/firmware-uploads.md).

export const PART_NAMES = [
  "bootloader.bin",
  "partitions.bin",
  "boot_app0.bin",
  "firmware.bin",
] as const;

export type PartName = (typeof PART_NAMES)[number];

// Arduino-ESP32 3.3.12 flash layout, the same on both boards. Never taken from an upload.
export const PART_OFFSETS: Record<PartName, number> = {
  "bootloader.bin": 0x0,
  "partitions.bin": 0x8000,
  "boot_app0.bin": 0xe000,
  "firmware.bin": 0x10000,
};

// esp_chip_id_t in the ESP image extended header.
const CHIP_IDS: Record<ProductId, { id: number; family: string; name: string }> = {
  round: { id: 9, family: "ESP32-S3", name: "Hue Round Display" },
  simple: { id: 13, family: "ESP32-C6", name: "Hue Simple Switch" },
};

const KEEP_RELEASES_WITH_PARTS = 5;

export function parseProductId(value: string): ProductId | null {
  return value === "round" || value === "simple" ? value : null;
}

export function parsePartName(value: string): PartName | null {
  return (PART_NAMES as readonly string[]).includes(value) ? (value as PartName) : null;
}

export function isVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function uploadTokenMatches(token: string | null): boolean | null {
  const expected = process.env.FIRMWARE_UPLOAD_TOKEN;
  if (!expected) return null;
  return secretMatches(token, expected);
}

// Returns why the image is wrong for this product, or null when it looks right.
export function checkImage(product: ProductId, name: PartName, data: Uint8Array): string | null {
  if (name !== "firmware.bin" && name !== "bootloader.bin") return null;
  if (data.length < 24 || data[0] !== 0xe9) return `${name} is not an ESP image`;
  const chipId = data[12] | (data[13] << 8);
  const want = CHIP_IDS[product];
  if (chipId !== want.id) {
    return `${name} is built for chip id ${chipId}, not ${want.family} (${want.id})`;
  }
  return null;
}

export type UploadPart = { name: PartName; data: Uint8Array };

// Third-party software linked into a firmware image, sent by firmware CI (docs/specs/finished/credits.md §2.4).
export type CreditEntry = { name: string; version: string; license: string; url: string };

const CREDIT_FIELDS = ["name", "version", "license", "url"] as const;
const MAX_CREDITS = 50;
const MAX_CREDIT_FIELD = 200;

// Returns the entries, or why the field is wrong.
export function parseCredits(raw: string): { credits: CreditEntry[] } | { problem: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { problem: "credits is not valid JSON" };
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CREDITS) {
    return { problem: `credits must be an array of 1 to ${MAX_CREDITS} entries` };
  }
  const credits: CreditEntry[] = [];
  for (const [i, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { problem: `credits[${i}] is not an object` };
    }
    const entry = {} as CreditEntry;
    for (const field of CREDIT_FIELDS) {
      const v = (item as Record<string, unknown>)[field];
      if (typeof v !== "string" || !v.trim() || v.length > MAX_CREDIT_FIELD) {
        return { problem: `credits[${i}].${field} must be a non-empty string of at most ${MAX_CREDIT_FIELD} characters` };
      }
      entry[field] = v.trim();
    }
    if (!/^https:\/\/\S+$/.test(entry.url)) {
      return { problem: `credits[${i}].url must start with https://` };
    }
    credits.push(entry);
  }
  return { credits };
}

export type UploadResult =
  | { status: "created" | "unchanged"; version: string }
  | { status: "version_exists"; version: string };

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function uploadRelease(input: {
  product: ProductId;
  version: string;
  commit: string | null;
  notes: string;
  credits: CreditEntry[] | null;
  parts: UploadPart[];
}): Promise<UploadResult> {
  const { product, version, commit, notes } = input;
  // Absent credits leave the stored ones as they are.
  const credits = input.credits ? JSON.stringify(input.credits) : null;
  const parts = input.parts.map((part) => ({
    name: part.name,
    size: part.data.length,
    sha256: sha256(part.data),
    base64: Buffer.from(part.data).toString("base64"),
  }));
  const db = sql();

  const existing = await db`
    select r.id, coalesce(json_object_agg(p.name, p.sha256) filter (where p.name is not null), '{}') as shas
    from firmware_releases r
    left join firmware_parts p on p.release_id = r.id
    where r.product = ${product} and r.version = ${version}
    group by r.id
  `;
  const row = existing[0] as { id: string; shas: Record<string, string> } | undefined;

  if (row && Object.keys(row.shas).length > 0) {
    // The bins of a released version never change (their URLs are cached forever); its notes can.
    const same = parts.every((part) => row.shas[part.name] === part.sha256);
    await db.transaction((tx) => [
      tx`update firmware_releases
         set notes = ${notes}, credits = coalesce(${credits}::jsonb, credits)
         where id = ${row.id}`,
      ...(same
        ? [
            tx`insert into firmware_current (product, release_id) values (${product}, ${row.id})
               on conflict (product) do update set release_id = excluded.release_id`,
          ]
        : []),
    ]);
    return { status: same ? "unchanged" : "version_exists", version };
  }

  // A new version, or one imported from the old changelog without bins.
  await db.transaction((tx) => [
    tx`insert into firmware_releases (product, version, commit_sha, notes, credits)
       values (${product}, ${version}, ${commit}, ${notes}, ${credits}::jsonb)
       on conflict (product, version)
       do update set commit_sha = coalesce(excluded.commit_sha, firmware_releases.commit_sha),
                     notes = excluded.notes,
                     credits = coalesce(excluded.credits, firmware_releases.credits)`,
    ...parts.map(
      (part) => tx`
        insert into firmware_parts (release_id, name, sha256, size, data)
        select id, ${part.name}, ${part.sha256}, ${part.size}, decode(${part.base64}, 'base64')
        from firmware_releases where product = ${product} and version = ${version}`,
    ),
    tx`insert into firmware_current (product, release_id)
       select product, id from firmware_releases where product = ${product} and version = ${version}
       on conflict (product) do update set release_id = excluded.release_id`,
  ]);
  await pruneParts(product);
  return { status: "created", version };
}

// Keeps the bins of the newest releases and the current one. Release rows stay: they are the changelog.
async function pruneParts(product: ProductId) {
  await sql()`
    delete from firmware_parts
    where release_id in (
      select id from (
        select r.id, row_number() over (order by r.created_at desc) as n
        from firmware_releases r
        where r.product = ${product}
          and exists (select 1 from firmware_parts p where p.release_id = r.id)
      ) ranked
      where n > ${KEEP_RELEASES_WITH_PARTS}
    )
    and release_id not in (select release_id from firmware_current where product = ${product})
  `;
}

export async function setCurrentRelease(product: ProductId, version: string): Promise<boolean> {
  const rows = await sql()`
    insert into firmware_current (product, release_id)
    select r.product, r.id from firmware_releases r
    where r.product = ${product} and r.version = ${version}
      and (select count(*) from firmware_parts p where p.release_id = r.id) = ${PART_NAMES.length}
    on conflict (product) do update set release_id = excluded.release_id
    returning release_id
  `;
  return rows.length > 0;
}

export type StoredRelease = {
  version: string;
  createdAt: string;
  hasBins: boolean;
  current: boolean;
};

/** Every release of a product, newest first, for /admin (docs/specs/finished/admin-tools.md §2.4). */
export async function listStoredReleases(product: ProductId): Promise<StoredRelease[]> {
  const rows = await sql()`
    select r.version, r.created_at,
      (select count(*)::int from firmware_parts p where p.release_id = r.id) as parts,
      exists (select 1 from firmware_current c where c.product = r.product and c.release_id = r.id) as current
    from firmware_releases r
    where r.product = ${product}
    order by string_to_array(r.version, '.')::int[] desc
  `;
  return (rows as { version: string; created_at: string; parts: number; current: boolean }[]).map((r) => ({
    version: r.version,
    createdAt: new Date(r.created_at).toISOString(),
    hasBins: Number(r.parts) === PART_NAMES.length,
    current: Boolean(r.current),
  }));
}

export async function currentVersion(product: ProductId): Promise<string | null> {
  const rows = await sql()`
    select r.version from firmware_current c
    join firmware_releases r on r.id = c.release_id
    where c.product = ${product}
  `;
  return rows[0] ? String((rows[0] as { version: string }).version) : null;
}

export async function currentManifest(product: ProductId) {
  const version = await currentVersion(product);
  if (!version) return null;
  const chip = CHIP_IDS[product];
  return {
    name: chip.name,
    version,
    new_install_prompt_erase: false,
    builds: [
      {
        chipFamily: chip.family,
        parts: PART_NAMES.map((name) => ({ path: `${version}/${name}`, offset: PART_OFFSETS[name] })),
      },
    ],
  };
}

export async function readPart(product: ProductId, version: string, name: PartName) {
  const rows = await sql()`
    select p.sha256, encode(p.data, 'base64') as data
    from firmware_parts p
    join firmware_releases r on r.id = p.release_id
    where r.product = ${product} and r.version = ${version} and p.name = ${name}
  `;
  const row = rows[0] as { sha256: string; data: string } | undefined;
  if (!row) return null;
  return { sha256: row.sha256, data: Buffer.from(row.data, "base64") };
}

// For HEAD: the stored size and hash, without reading the bytes.
export async function readPartMeta(product: ProductId, version: string, name: PartName) {
  const rows = await sql()`
    select p.sha256, p.size
    from firmware_parts p
    join firmware_releases r on r.id = p.release_id
    where r.product = ${product} and r.version = ${version} and p.name = ${name}
  `;
  const row = rows[0] as { sha256: string; size: number } | undefined;
  if (!row) return null;
  return { sha256: row.sha256, size: Number(row.size) };
}

export type FirmwareNotes = { version: string; date: string; notes: string };

export async function listReleaseNotes(product: ProductId): Promise<FirmwareNotes[]> {
  const rows = await sql()`
    select version, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as date, notes
    from firmware_releases
    where product = ${product} and notes <> ''
    order by string_to_array(version, '.')::int[] desc
  `;
  return rows.map((row) => {
    const r = row as FirmwareNotes;
    return { version: String(r.version), date: String(r.date), notes: String(r.notes) };
  });
}

export type CurrentCredits = { version: string; credits: CreditEntry[] | null };

export async function currentCredits(product: ProductId): Promise<CurrentCredits | null> {
  const rows = await sql()`
    select r.version, r.credits from firmware_current c
    join firmware_releases r on r.id = c.release_id
    where c.product = ${product}
  `;
  const row = rows[0] as { version: string; credits: CreditEntry[] | null } | undefined;
  if (!row) return null;
  return { version: String(row.version), credits: Array.isArray(row.credits) ? row.credits : null };
}

export type AppImage = { version: string; sha256: string; size: number };

/** The current release's `firmware.bin`, what an OTA offer points at (docs/specs/ota.md §2.2). */
export async function currentAppImage(product: ProductId): Promise<AppImage | null> {
  const rows = await sql()`
    select r.version, p.sha256, p.size
    from firmware_current c
    join firmware_releases r on r.id = c.release_id
    join firmware_parts p on p.release_id = r.id and p.name = 'firmware.bin'
    where c.product = ${product}
  `;
  const row = rows[0] as { version: string; sha256: string; size: number } | undefined;
  if (!row) return null;
  return { version: String(row.version), sha256: String(row.sha256), size: Number(row.size) };
}
