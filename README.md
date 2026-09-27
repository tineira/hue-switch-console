# hue-switch-console

Web console (Vercel + Neon Postgres) for Wi-Fi Hue wall switches. **It never talks
to the Bridge.** A XIAO or `npm run push-from-bridge` uploads topology.
Humans sign in with Google, GitHub or an emailed code (a password on self-hosted consoles
without email). Devices use an API key.

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
# DATABASE_URL (your own Postgres; DATABASE_DRIVER=pg unless it is Neon),
# AUTH_SECRET, USER_EMAIL, USER_PASSWORD, EMAIL_DEV_CONSOLE=1
npm install
npm run dev
```

Use a development database, never production. The console creates its tables and
the first user on the first request. Open [http://localhost:3000/login](http://localhost:3000/login)
and sign in with `USER_EMAIL` / `USER_PASSWORD`. Full walkthrough: [`CONTRIBUTING.md`](CONTRIBUTING.md).

Boards are flashed and provisioned from **Setup** (`/setup`; `/devices` and
`/install` redirect there) in Chrome or Edge over USB. That screen writes Wi-Fi (Improv)
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

## Accounts and sign-in

Sign-in is [Better Auth](https://www.better-auth.com) running inside the console on the
same Postgres; there is no auth service to sign up for. Spec:
[`docs/specs/finished/multi-user-accounts.md`](docs/specs/finished/multi-user-accounts.md).

**Self-hosting** needs only `DATABASE_URL`, `AUTH_SECRET`, `USER_EMAIL` and `USER_PASSWORD`.
That gives one account with a password; sign-up stays closed. Neon is the default
driver; for any other Postgres set `DATABASE_DRIVER=pg`.

**Hosted** (`hue.tineira.com`) adds, each optional and off until set:

| Env var | Turns on |
| --- | --- |
| `RESEND_API_KEY`, `EMAIL_FROM` | Emailed 6-digit codes, invites and notices. Password sign-in turns off. `EMAIL_FROM` e.g. `Hue Switch <codes@hue.tineira.com>` (domain verified in Resend) |
| `SIGNUP_MODE` | `closed` (default), `invite`, `waitlist` or `open`. `/admin` can switch between `invite` and `waitlist` |
| `USER_CAP` | Seats (accounts plus unused invites) the `waitlist` mode fills automatically, until the admin saves a cap in `/admin` (default: no cap) |
| `WAITLIST_EMAILS_PER_DAY` | Waitlist invites and confirmations a day, within `EMAIL_DAILY_CAP` (default 40) |
| `RESEND_WEBHOOK_SECRET` | Resend webhook at `/api/webhooks/resend` (`email.bounced`, `email.complained`, `email.suppressed`): undeliverable addresses leave the waitlist |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Continue with Google. Callback `https://<host>/api/auth/callback/google` |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Continue with GitHub. Callback `https://<host>/api/auth/callback/github` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile on the email and waitlist forms |
| `BETTER_AUTH_URL` | Public URL for OAuth callbacks and links in emails (else taken from the request) |
| `ADMIN_EMAILS` | Comma-separated admins for `/admin` (default: `USER_EMAIL`) |
| `CRON_SECRET` | The daily cleanup cron (`vercel.json`) |
| `EMAIL_DAILY_CAP` | Emails a day before email sign-in says it is busy (default 90, under Resend's free 100) |
| `LIMIT_SWITCHES`, `LIMIT_BRIDGES`, `LIMIT_KEYS`, `LIMIT_SNAPSHOT_KB` | Per-account limits (25, 5, 25, 512); `/admin` overrides one account |
| `CONTACT_EMAIL` | Contact shown on `/privacy` (else the operator's X profile) |
| `PRIVACY_URL`, `TERMS_URL` | Replace the `/privacy` link under the sign-in form; add a Terms link |

Local development without sending mail: `EMAIL_DEV_CONSOLE=1` prints codes to the
server log instead (never in production).

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
console, and Setup offers that build to every board plugged in over USB at
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
Bumping it is what makes Setup offer **Update**. A rebuild without a bump is
answered `409 version_exists`: the bins stay as they were (their URLs are cached
forever) and only the notes are updated. Spec:
[`docs/specs/finished/firmware-uploads.md`](docs/specs/finished/firmware-uploads.md).

The console checks every upload: all four parts, a `major.minor.patch` version,
non-empty notes, and the chip id inside `bootloader.bin` / `firmware.bin`
(ESP32-S3 for `round`, ESP32-C6 for `simple`). It keeps the bins of the last 5
releases per product plus the current one. Release rows and their notes are
kept for the changelog.

Each upload also sends `credits`: the firmware repo's `THIRD_PARTY.json`, the
third-party software linked into the image (core, ESP-IDF, every library
pinned in `sketch.yaml`). Firmware CI fails when that file and `sketch.yaml`
disagree. The console shows the current release's list on the public
`/credits` page; the field is optional, and a re-upload of the same version
replaces it. Spec: [`docs/specs/finished/credits.md`](docs/specs/finished/credits.md).

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
| Firmware run fails: `FIRMWARE_UPLOAD_TOKEN ... missing; cannot upload the release to the console` | Secret missing or empty in that firmware repo |
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

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Bugs and ideas go in GitHub issues.

## Sponsor

The console and the switch firmwares are free and stay that way. If they are useful
to you, you can [sponsor the project on GitHub](https://github.com/sponsors/tineira).
Sponsorship helps pay for development and does not unlock anything.

## License

Copyright (C) 2026 Tomas Neira and contributors.

The console is free software under the [GNU Affero General Public License v3.0](LICENSE)
(`AGPL-3.0-only`). If you run a modified copy as a network service, you must
offer its users the source of your version; the site footer's "Source" link does
that for this deployment. Contributions are accepted under the same license.

The switch firmwares, [`hue-round-switch`](https://github.com/tineira/hue-round-switch)
and [`hue-simple-switch`](https://github.com/tineira/hue-simple-switch), are MIT.

Not affiliated with or endorsed by Signify. Philips Hue is a trademark of Signify.
