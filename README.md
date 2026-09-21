# hue-switch-console

Web console (Vercel + Neon Postgres) for Wi-Fi Hue wall switches. **It never talks
to the Bridge.** A XIAO or `npm run push-from-bridge` uploads topology.
Humans sign in with email + password (cookie `hsw_session`). Devices use an API key.

Two products, one console:

- **Simple** (`hue-simple-switch`, ESP32-C6) — GPIO channels (`boot` / `d0` / `d1` / `d2`), recipes per channel and event.
- **Round** (`hue-round-switch`, ESP32-S3 + circle) — pages (room/zone group, tap / double-tap, scene lists, dimmer). Not GPIO.

Product UI is **English**.

Device HTTP contract: [`docs/device-api.md`](docs/device-api.md).
Product model: [`docs/definiciones.md`](docs/definiciones.md).
Round pages: [`docs/round-pages.md`](docs/round-pages.md).

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

Open [http://localhost:3000](http://localhost:3000), sign in, create a device
API key, copy it once.

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
