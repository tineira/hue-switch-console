# hue-switch-console

Consola web (Vercel) para ver la topología Hue que suben los interruptores Wi‑Fi. **No habla con el Bridge.** El snapshot lo manda un XIAO (más adelante) o `npm run push-from-bridge` desde un PC en la LAN.

El firmware vive en otro repo: `hue-simple-switch`.

## Local

```bash
cp .env.example .env.local
# edita INGEST_TOKEN
npm install
npm run dev
```

En otra terminal, con el Bridge al alcance:

```bash
# PowerShell
$env:HUE_BRIDGE_IP="192.168.100.12"
$env:HUE_APP_KEY="tu-key"
$env:INGEST_TOKEN="el-mismo-de-.env.local"
npm run push-from-bridge
```

Abre [http://localhost:3000](http://localhost:3000).

## API

`POST /api/ingest` (header `Authorization: Bearer INGEST_TOKEN`)

```json
{
  "bridgeid": "C42996FFFECA6703",
  "bridge_ip": "192.168.100.12",
  "source": "xiao",
  "lights": [{ "id": "uuid", "name": "Velador", "on": true, "caps": ["dim", "ct"] }],
  "rooms": [{ "id": "uuid", "name": "Dormitorio Principal" }]
}
```

En local el JSON queda en `data/topology.json` (gitignored). En Vercel hace falta [KV](https://vercel.com/docs/storage/vercel-kv) (`KV_REST_API_URL` + `KV_REST_API_TOKEN`); sin eso el snapshot no sobrevive entre deploys.

## Vercel

```bash
npx vercel
```

Pon `INGEST_TOKEN` en Project → Environment Variables. Opcional: añade KV y las dos vars `KV_*`.
