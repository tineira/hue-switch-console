# hue-switch-console

Web console (Vercel + Supabase) for Wi-Fi Hue wall switches. **It never talks
to the Bridge.** A XIAO or `npm run push-from-bridge` uploads topology.
Humans sign in with email + password. Devices use an API key.

Firmware lives in `hue-simple-switch`. Product UI is **English**.

Device HTTP contract: [`docs/device-api.md`](docs/device-api.md).
Product model: [`docs/definiciones.md`](docs/definiciones.md).

Production host: `https://hue.tineira.com`.

## Local

```bash
cp .env.example .env.local
# set Supabase URL + anon/publishable key + service role
# set USER_EMAIL / USER_PASSWORD for the seeded account
npm install
npx supabase db push   # after supabase link, or apply the SQL in the dashboard
npm run seed-user
npm run dev
```

Disable public signups in the Supabase Auth settings (this repo’s local
`supabase/config.toml` already has `enable_signup = false`).

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

- `POST /api/device/register` — Bearer device key; MAC, firmware, channels, rich snapshot
- `GET /api/device/config?mac=` — `{ rev, recipes[] }`
- `PUT /api/switches/{mac}/recipes` — logged-in user

`POST /api/ingest` is gone (`410`). Postgres replaces the old file / KV store.

Firmware TLS against `https://hue.tineira.com` must **verify** the certificate.
