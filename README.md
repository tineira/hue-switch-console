# hue-switch-console

Web console (Vercel + Neon Postgres) for Wi-Fi Hue wall switches. **It never talks
to the Bridge.** A XIAO or `npm run push-from-bridge` uploads topology.
Humans sign in with email + password (cookie `hsw_session`). Devices use an API key.

Two products, one console:

- **Simple** (`hue-simple-switch`, ESP32-C6) — GPIO channels (`boot` / `d0` / `d1` / `d2`), recipes per channel and event.
- **Round** (`hue-round-switch`, ESP32-S3 + circle) — pages (room/zone group, tap / double-tap, scene lists, dimmer). Not GPIO.

Everything in the three repos is **English**: UI, docs, comments.

This repo owns the contract the switches implement:

- Device HTTP contract: [`docs/device-api.md`](docs/device-api.md).
- Product model: [`docs/definitions.md`](docs/definitions.md).
- Round pages: [`docs/round-pages.md`](docs/round-pages.md).
- Cross-repo changes: [`AGENTS.md`](AGENTS.md) ("Multi-repo") and [`docs/specs/TEMPLATE.md`](docs/specs/TEMPLATE.md).

Production host: `https://hue.tineira.com`.

## Local

```bash
cp .env.example .env.local
# DATABASE_URL from Vercel/Neon, AUTH_SECRET, USER_EMAIL, USER_PASSWORD
npm install
npx vercel env run -e production -- node scripts/migrate.mjs
npx vercel env run -e production -- node scripts/seed-user.mjs
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

Boards are flashed and provisioned from **Devices** (`/devices`; `/install`
redirects there) in Chrome or Edge over USB. That screen writes Wi-Fi (Improv)
and a device token (`HUESET`); it always points the XIAO at
`https://hue.tineira.com`, not localhost. Nothing is compiled into the firmware:
`config.h` holds only `SERIAL_DEBUG`, in dev too. Firmware images are uploaded by
firmware CI and served from the database (see below).

On a PC that can reach the Bridge:

```bash
# PowerShell
$env:HUE_BRIDGE_IP="192.168.100.12"
$env:HUE_APP_KEY="your-hue-key"
$env:CONSOLE_TOKEN="hsw_…"
$env:CONSOLE_URL="http://localhost:3000"
npm run push-from-bridge
```

## Device API

See [`docs/device-api.md`](docs/device-api.md). Short version:

- `POST /api/device/register` — Bearer device key; MAC, firmware, `product`, channels, rich snapshot
- `GET /api/device/config?mac=` — Simple: `{ rev, recipes[] }` with `channelId`. Round: `{ rev, product, pageSwipeAxis, screenTimeoutSec, pages[], recipes[] }` with `pageId` (not recipes-only)
- `PUT /api/switches/{mac}/recipes` — logged-in user, Simple GPIO
- `PUT /api/switches/{mac}/pages` — logged-in user, Round pages

`POST /api/ingest` is gone (`410`). Postgres replaces the old file / KV store.

Firmware TLS against `https://hue.tineira.com` must **verify** the certificate.

## Firmware release pipeline

A push to `main` in a firmware repo **is a release**: it is uploaded to the
console, and Devices offers that build to every board plugged in over USB at
once. No commit lands in this repo and nothing redeploys.

```text
push to main (hue-round-switch / hue-simple-switch)
  → .github/workflows/firmware.yml: build (SERIAL_DEBUG 0), read FIRMWARE_VERSION
  → notes = that version's section of the firmware repo's CHANGELOG.md
  → POST https://hue.tineira.com/api/firmware/<product>      [FIRMWARE_UPLOAD_TOKEN]
  → Postgres: firmware_releases + firmware_parts, firmware_current = this release
  → /firmware/<product>/manifest.json and /changelog show it on the next request
```

`FIRMWARE_VERSION` in the firmware source is the version the wizard shows.
Bumping it is what makes Devices offer **Update**. A rebuild without a bump is
answered `409 version_exists`: the bins stay as they were (their URLs are cached
forever) and only the notes are updated. Spec:
[`docs/specs/firmware-uploads.md`](docs/specs/firmware-uploads.md).

The console checks every upload: all four parts, a `major.minor.patch` version,
non-empty notes, and the chip id inside `bootloader.bin` / `firmware.bin`
(ESP32-S3 for `round`, ESP32-C6 for `simple`). It keeps the bins of the last 5
releases per product plus the current one. Release rows and their notes are
kept for the changelog.

### Flash layout

The console serves the four parts at fixed offsets, never taken from an
upload. Same on both boards (Arduino-ESP32 3.3.12):

| Part | Offset | Source |
| --- | --- | --- |
| `bootloader.bin` | `0x0` | `boards.txt` `build.bootloader_addr` for XIAO_ESP32S3 and XIAO_ESP32C6 |
| `partitions.bin` | `0x8000` | ESP32 image layout |
| `boot_app0.bin` | `0xe000` | `otadata` in `default_8MB.csv` (Round) and `hue-simple-switch/partitions.csv` |
| `firmware.bin` | `0x10000` | `app0` in the same tables |

The wizard never erases flash. NVS (Hue, recipes, pages, `console`) must
survive a reflash.

### Token

One random secret, `FIRMWARE_UPLOAD_TOKEN`, stored in three places: Vercel
(Production) and the Actions secrets of both firmware repos. To set or rotate
it, run in PowerShell from this repo, then redeploy the console:

```powershell
$t = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }); $t | npx vercel env add FIRMWARE_UPLOAD_TOKEN production; $t | gh secret set FIRMWARE_UPLOAD_TOKEN -R tineira/hue-round-switch; $t | gh secret set FIRMWARE_UPLOAD_TOKEN -R tineira/hue-simple-switch; Remove-Variable t
```

(To rotate, remove the old Vercel value first with
`npx vercel env rm FIRMWARE_UPLOAD_TOKEN production`.)

### Rollback and local builds

Point the installer at an older stored release:

```bash
curl -X POST https://hue.tineira.com/api/firmware/round/current -H "Authorization: Bearer $FIRMWARE_UPLOAD_TOKEN" -H "Content-Type: application/json" -d '{"version":"0.5.27"}'
```

Upload a local build (a folder with the four bins) with
`scripts/upload-firmware.mjs <product> <dir> --version x.y.z --notes <file>`.

### When it breaks

| Symptom | Cause |
| --- | --- |
| Firmware run log: `FIRMWARE_UPLOAD_TOKEN missing; skip console upload` | Secret missing or empty in that firmware repo |
| Upload answers `401` | The firmware repo's secret and Vercel's differ; set both again |
| Upload answers `503 upload_not_configured` | No `FIRMWARE_UPLOAD_TOKEN` on Vercel, or no redeploy since it was set |
| Upload answers `400 missing_notes` | No `### <version>` section in that repo's `CHANGELOG.md` |
| Upload answers `400 invalid_image` | A part is missing, empty, or built for the other chip |
| Upload answers `409 version_exists` | Same version, new bins: bump `FIRMWARE_VERSION` |

### Adding a switch

A new firmware repo needs: a `firmware.yml` upload step like the existing two,
a `CHANGELOG.md`, the `FIRMWARE_UPLOAD_TOKEN` secret, its product id in
`lib/firmware.ts` (chip id, family) and `lib/web-setup/products.ts`, the id in
the `firmware_releases` / `firmware_current` checks in `db/schema.sql` and
`lib/ensure-schema.ts`, a `## <Product>` intro in `docs/changelog.md`, and a
row in `AGENTS.md` ("Multi-repo").
