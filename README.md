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
`config.h` holds only `SERIAL_DEBUG`, in dev too. Firmware images live under
`public/firmware/` (see below).

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

A push to `main` in a firmware repo **is a release**: the Devices screen offers
that build to every board plugged in over USB.

```text
push to main (hue-round-switch / hue-simple-switch)
  → .github/workflows/firmware.yml: build (SERIAL_DEBUG 0), read FIRMWARE_VERSION
  → GitHub Release "usb-installer" in that repo (rolling, four bins)
  → repository_dispatch "firmware-bins" to this repo      [CONSOLE_REPO_TOKEN]
  → .github/workflows/sync-firmware-bins.yml: download the release    [FIRMWARE_REPO_TOKEN]
  → copy into public/firmware/<product>/, set manifest.json version, bot commit
  → Vercel deploy → /devices serves the new version
```

`FIRMWARE_VERSION` in the firmware source is the version the wizard shows.
Bumping it is what makes Devices offer **Update**. Offsets and file layout:
[`public/firmware/README.md`](public/firmware/README.md).

### Tokens

All three repos are private, so each hop needs a token. It is **one**
fine-grained GitHub token, stored as three secrets:

| Secret | Repo | Used for |
| --- | --- | --- |
| `CONSOLE_REPO_TOKEN` | `hue-round-switch` | Trigger this repo's sync |
| `CONSOLE_REPO_TOKEN` | `hue-simple-switch` | Trigger this repo's sync |
| `FIRMWARE_REPO_TOKEN` | `hue-switch-console` | Download the firmware repos' releases |

Token settings (github.com → Settings → Developer settings → Fine-grained tokens):

- **Repository access:** `hue-switch-console`, `hue-round-switch`, `hue-simple-switch`.
- **Permissions:** Contents **read and write** (write is needed on this repo;
  the permission applies to every selected repo).
- **Expiration:** your choice. Put the date in a calendar.

Set or rotate it by copying the token and running, in PowerShell:

```bash
Get-Clipboard | gh secret set CONSOLE_REPO_TOKEN -R tineira/hue-round-switch
Get-Clipboard | gh secret set CONSOLE_REPO_TOKEN -R tineira/hue-simple-switch
Get-Clipboard | gh secret set FIRMWARE_REPO_TOKEN -R tineira/hue-switch-console
```

The `gh secret set` prompt hides input, so a paste that didn't take saves an
empty secret silently. Piping from the clipboard avoids that.

### When it breaks

| Symptom | Cause |
| --- | --- |
| Firmware run log: `CONSOLE_REPO_TOKEN missing; skip repository_dispatch` | Secret missing or empty in that firmware repo |
| Firmware "Notify console" step fails with 401/403 | Token expired, or lost access to this repo |
| "Sync USB installer bins" fails with `release not found` | `FIRMWARE_REPO_TOKEN` missing, expired, or lost access to that firmware repo |
| Sync succeeds, "No firmware file changes" | Nothing new; expected when the source didn't change |

Manual fallback: run **Sync USB installer bins** from this repo's Actions tab
(`workflow_dispatch`, product `round` / `simple` / `all`).

### Adding a switch

A new firmware repo needs: a `firmware.yml` like the existing two (publishing
`usb-installer` and dispatching `firmware-bins` with its `product`), the repo
added to the token, its own `CONSOLE_REPO_TOKEN` secret, a `sync_product` line
in `sync-firmware-bins.yml`, a `public/firmware/<product>/` folder, and a row
in `AGENTS.md` ("Multi-repo").
