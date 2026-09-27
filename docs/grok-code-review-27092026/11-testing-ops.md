# Testing y operaciones

## CI (`.github/workflows/ci.yml`)

`npm ci` + lint + `next typegen` + `tsc --noEmit` + build. `permissions: contents: read`. Sin secrets. Bien para no filtrar env.

**No hay tests.** Ni unit de `parse*` / `checkImage` / `validateRoundConfig`, ni contract tests del device API. `AGENTS.md` dice que Playwright local no vale (no hay DB ni Web Serial). Aun así:

- parsers y firmware `checkImage` se testean sin hardware;
- register P4 se testea con un snapshot previo.

## Cron

`vercel.json`: `GET /api/cron/cleanup` diario 06:00 UTC. Bearer `CRON_SECRET`. Si el secret no está, 503 (el cron de Vercel fallaría callado). Limpia events/sessions/verifications/rate_limits/invite_requests viejos; **nunca** borra accounts. Admite waitlist.

Comparación del secret no es timing-safe (ver 02).

## Observabilidad

Casi no hay métricas. `/admin` yardsticks. `console.error` en send OTP y waitlist admit. Sin request id. Un 500 de placa es opaco si se quitan los `details` — hace falta log estructurado antes de tapar la fuga.

## Scripts

- `push-from-bridge.mjs`: corre en la LAN. Hallazgo de equipo: `NODE_TLS_REJECT_UNAUTHORIZED=0` process-wide — **HIGH en la máquina que lo corre**, no en Vercel. No usar contra prod pública. Manda `channels: []` sin product (topology-only; mac undefined).
- `upload-firmware.mjs`: local bins.
- `seed-user.mjs` / `migrate.mjs`: self-host.
- `credits.mjs` en `prebuild`.

## Deploy

Vercel + Neon. Console no habla con el Bridge. Firmware TLS debe verificar el cert de `hue.tineira.com` (README). El script push-from-bridge hoy contradice eso si deja `NODE_TLS_REJECT_UNAUTHORIZED=0`.
