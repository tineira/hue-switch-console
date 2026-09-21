# hue-switch-console

Web console (Vercel + Neon Postgres) for Wi-Fi Hue wall switches. **It never talks
to the Bridge.** A XIAO or `npm run push-from-bridge` uploads topology.
Humans sign in with email + password. Devices use an API key.

Firmware lives in `hue-simple-switch`. Product UI is **English**.

Device HTTP contract: [`docs/device-api.md`](docs/device-api.md).
Product model: [`docs/definiciones.md`](docs/definiciones.md).

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

Product boards are flashed from **Install** (`/install`) in Chrome or Edge over
USB. That screen writes Wi-Fi + a device token; it always points the XIAO at
`https://hue.tineira.com`, not localhost. Firmware images live under
`public/firmware/` (see that README). Developers can still create a key and
copy it into `config.h`.

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

- `POST /api/device/register` — Bearer device key; MAC, firmware, channels, rich snapshot
- `GET /api/device/config?mac=` — `{ rev, recipes[] }`
- `PUT /api/switches/{mac}/recipes` — logged-in user

`POST /api/ingest` is gone (`410`). Postgres replaces the old file / KV store.

Firmware TLS against `https://hue.tineira.com` must **verify** the certificate.
