# Firmware uploads

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** done

## 1. What and why

A firmware release becomes an **upload** to the console, not a commit to it. A firmware push to `main` builds the four installer bins and posts them to the console. The console stores them in Postgres and serves `/install` and Devices from there at once: no bot commit, no `git pull` conflicts, no Vercel redeploy, and no megabytes of binaries in this repo's history. A rollback is moving a pointer back to an older release.

The same catalog (version, sha256, size, published time per product) is what `docs/specs/ota.md` §5.1 needs, so OTA builds on it later.

## 2. Contract change

`docs/device-api.md`: **no change.** Boards never see this; they keep flashing over USB from the wizard.

What changes is the installer contract (firmware CI → console → wizard):

### 2.1 Storage (Postgres, `db/schema.sql`) — additive

```sql
create table if not exists firmware_releases (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product in ('round', 'simple')),
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  commit_sha text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (product, version)
);

create table if not exists firmware_parts (
  release_id uuid not null references firmware_releases (id) on delete cascade,
  name text not null check (name in ('bootloader.bin', 'partitions.bin', 'boot_app0.bin', 'firmware.bin')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size integer not null check (size > 0),
  data bytea not null,
  primary key (release_id, name)
);

create table if not exists firmware_current (
  product text primary key check (product in ('round', 'simple')),
  release_id uuid not null references firmware_releases (id)
);
```

Offsets are **not** stored or uploaded. They come from the product spec in the console (`lib/web-setup/products.ts`), the same four addresses as today (`0x0`, `0x8000`, `0xe000`, `0x10000`). A bad upload cannot move a part.

### 2.2 Upload — new

`POST /api/firmware/{product}` — `product` is `round` or `simple`.

- **Auth:** `Authorization: Bearer <FIRMWARE_UPLOAD_TOKEN>`. One shared secret, set on Vercel and in each firmware repo's Actions secrets. Not a device key and not a user session: a release belongs to the product, not to a user. Compared in constant time.
- **Body:** `multipart/form-data` with `version`, optional `commit`, `notes` (the changelog entry, §2.4), and the four files named as above. About 1.3 MB in total, under Vercel's 4.5 MB request limit.
- **Checks, all before writing:**
  - all four parts present and non-empty;
  - `version` is `major.minor.patch`;
  - `firmware.bin` and `bootloader.bin` start with the ESP image magic `0xE9`, and the image header's chip id matches the product (`9` = ESP32-S3 for `round`, `13` = ESP32-C6 for `simple`). A C6 image can never become the Round installer;
  - the console computes sha256 and size itself.
- **Effect (one transaction):** insert the release and its parts, then point `firmware_current` at it. A push to firmware `main` is a release today; that stays true.
- **Responses:**
  - `201` new release, now current;
  - `200` same `product` + `version` with identical sha256 for every part (CI re-run): no change, made current again;
  - `409 version_exists` same version, different bytes (Arduino builds are not byte-for-byte reproducible, so a rebuild without a version bump lands here). The bins stay as they were; the notes are updated. Bump `FIRMWARE_VERSION` to ship new bins;
  - `400 invalid_image` with which check failed;
  - `400 missing_notes`, `400 invalid_version`;
  - `401` bad or missing token; `503 upload_not_configured` when the console has no `FIRMWARE_UPLOAD_TOKEN`.
- A release row imported from the old changelog (no bins yet) takes the bins of its first upload as a new release.
- **Retention:** after a successful upload, keep the **parts** of the newest 5 releases per product plus the current one; delete older parts. Release rows (version, date, notes) are kept forever: they are the changelog.

`POST /api/firmware/{product}/current` with `{ "version": "0.5.27" }`, same token: rollback / roll forward to a stored release. `404` if that version is not stored.

### 2.3 Serving — replaces `public/firmware/`

- `GET /firmware/{product}/manifest.json` — route handler, built from `firmware_current`. Same JSON shape as today, so `parseManifest` and esptool-js do not change. Part paths become versioned: `"path": "0.5.28/firmware.bin"`. `Cache-Control: no-store` (it is tiny, and it must change the moment a release lands).
- `GET` and `HEAD /firmware/{product}/{version}/{name}` — the bytes from `firmware_parts`, `Content-Type: application/octet-stream`, `ETag` = sha256, `Cache-Control: public, max-age=31536000, immutable`. The URL names the version, so the CDN caches it forever and the database is read about once per part per release.
- `lib/web-setup/manifest.ts`: part downloads drop `cache: "no-store"` (versioned URLs cannot go stale). The manifest fetch keeps it.
- The two build-time imports of `public/firmware/*/manifest.json` (`app/bridges/[bridgeid]/page.tsx`, `app/how-to/page.tsx`) become a runtime read of the current version (`lib/firmware.ts`).

### 2.4 Changelog

Firmware release notes travel **with the upload**, so a release needs no console commit at all.

- Each firmware repo keeps its notes next to the code: `CHANGELOG.md` at its root, one `### <version> — <date>` heading per `FIRMWARE_VERSION`, bullets in the same user-facing wording as today. The notes for a version are written in the same commit that bumps `FIRMWARE_VERSION`.
- CI extracts the section whose heading matches `FIRMWARE_VERSION` and sends it as `notes`. If there is none, the upload is rejected with `400 missing_notes`, so a release cannot ship without an entry.
- A re-upload of the same version with identical bins but edited notes (`200`) updates `notes`. Fixing a typo is a firmware push, still no console commit.
- `/changelog` renders **Console** from `docs/changelog.md` as today, and **Round** / **Simple** from `firmware_releases` (newest first). Anchors stay `#round-0.5.28`, so the Devices link (`lib/changelog-href.ts`) does not change.
- Seed: the existing `## Round` and `## Simple` entries in `docs/changelog.md` are imported once into `firmware_releases` (rows without parts), then removed from that file. The `<!-- commit -->` markers become `commit_sha`.
- `docs/changelog.md` becomes console-only. The console still has no version; its entries keep going in with the console change, which is a commit anyway.

### 2.5 Local builds

`scripts/upload-firmware.mjs <product> <dir>` posts a local `dist/installer/` with the same endpoint and token, for a build that did not come from CI. Replaces "copy into `public/firmware/`".

## 3. Compatibility

- **Boards:** unaffected. The wizard flashes the same four parts at the same offsets. NVS is untouched as today (no erase).
- **Console before firmware CI switches:** phase A (below) only adds the endpoint; `/install` keeps serving `public/firmware/`. Nothing breaks if no upload ever arrives.
- **Firmware CI before console deploys:** the upload step would get `404`. Make it non-fatal (warn) until phase B, like the current `CONSOLE_REPO_TOKEN missing` skip.
- **Route vs. static file:** `/firmware/{product}/manifest.json` cannot be both a file in `public/` and a route. Phase B deletes `public/firmware/` and adds the routes in the **same commit**, after both products have a current release in the database.
- **Old path removal:** the `repository_dispatch` in firmware CI, `sync-firmware-bins.yml`, `FIRMWARE_REPO_TOKEN` and `CONSOLE_REPO_TOKEN` go once phase B is live and one upload per product has been verified on production. A dispatch to this repo after the workflow is gone is ignored, not an error.

### Phases

1. **A — console:** tables, upload and `current` endpoints, upload script. `/install` unchanged.
2. **Firmware CI (both):** add the upload step next to the existing release + dispatch.
3. **Seed:** upload the bins currently in `public/firmware/` with the script, so the database matches what production serves (Round `0.5.28`, Simple `0.2.10` at the time of writing).
4. **B — console:** serve from the database, delete `public/firmware/` bins and `sync-firmware-bins.yml`, runtime version reads.
5. **Cleanup:** firmware CI drops the dispatch and `CONSOLE_REPO_TOKEN`; this repo drops `FIRMWARE_REPO_TOKEN`.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Phase A: schema, `POST /api/firmware/{product}`, `POST /api/firmware/{product}/current`, image checks, retention
- [x] `scripts/upload-firmware.mjs`
- [x] `FIRMWARE_UPLOAD_TOKEN` set on Vercel (Production) — by the user
- [x] `/changelog` reads Round / Simple from `firmware_releases`; one-time import of the existing firmware entries, then remove them from `docs/changelog.md`
- [x] Seed both products; check `select product, version from firmware_releases`
- [x] Phase B: manifest and part routes, `HEAD` supported, runtime version reads, part fetches cacheable
- [x] Phase B: delete `public/firmware/*/*.bin` + `manifest.json`, `.github/workflows/sync-firmware-bins.yml`; rewrite `public/firmware/README.md` into the root `README.md` "Firmware release pipeline"
- [x] Update `AGENTS.md`: the `public/firmware/` ownership paragraph, and the source-of-truth list (`docs/changelog.md` becomes console-only; firmware notes live in each firmware repo); also `docs/specs/TEMPLATE.md` ("Installer bins synced" → "Release uploaded")
- [x] Deployed; on production: `/firmware/round/manifest.json` shows the uploaded version, a second part download is a CDN hit (`x-vercel-cache: HIT`)
- [x] A USB install from Devices by the user succeeds (Round 0.5.28 and Simple 0.2.10, 2026-09-24)

### Round (`hue-round-switch`)

- [x] `firmware.yml`: after compile, `curl` the four bins to `POST /api/firmware/round` with `FIRMWARE_UPLOAD_TOKEN`; warn-only until phase B, then fail the run on non-2xx
- [x] `CHANGELOG.md` at the repo root, starting with the current version; CI sends that version's section as `notes`
- [x] `FIRMWARE_UPLOAD_TOKEN` secret set — by the user
- [x] Cleanup: dispatch step removed; upload runs before the `usb-installer` release, which stays as a download link; upload failures fail the run (409 warns)
- [x] AGENTS.md: release section says "push = upload to the console"

### Simple (`hue-simple-switch`)

- [x] Same items as Round, with `product = simple`

### Cleanup

- [x] `CONSOLE_REPO_TOKEN` (both firmware repos) and `FIRMWARE_REPO_TOKEN` (this repo) deleted — by the user, with the fine-grained token behind them

## 5. Limits (free tiers, checked 2026-09-24)

- **Neon:** 512 MB logical size per branch. Today about 17 MB, almost all Postgres system catalogs in two databases; the app tables are under 1 MB. (Neon's "33 MB" figure also counts 6 h of restore history.) Retention of 5 releases × 2 products × ~1.3 MB ≈ 13 MB.
- **Vercel Hobby:** part downloads are CDN hits after the first, counting against the regular 100 GB/month transfer. Function body limit 4.5 MB > one release.
- **To verify in phase A:** the Neon HTTP driver returns `bytea` hex-encoded (~2.5 MB for `firmware.bin`); confirm it is under the driver's response size limit, or read the part in chunks (`substring(data from … for …)`).

## 6. Open questions

1. **Changelog location.** §2.4 moves firmware notes into each firmware repo's `CHANGELOG.md` and the database. The alternative is keeping them in `docs/changelog.md` here, which keeps one file for everything but means every release is still a console commit and deploy. Proposal: §2.4.
2. **Upload from the console UI.** A signed-in upload form (for a local build) instead of or next to the script? Proposal: script only in v1; the console has several users and no admin role.
3. **Auto-current.** Every upload becomes current at once (today's behavior). Should a release land as "staged" and need a click to go live? Proposal: no for v1; rollback covers mistakes.
