# Device API

Rutas: `POST /api/device/register`, `GET /api/device/config`, `POST /api/ingest` (410).
Auth: Bearer device key (`lib/device-auth.ts`).

## Bien hecho

- Register exige `bridgeid`, `lights[]` (array). MAC 12 hex.
- Límites de bridges/switches + 413 por snapshot.
- Config 204 cuando `reported === rev` (después de armar el body).
- `X-Poll-Sec` + `pollSec` (30 s editing/behind/sin config, 900 s idle).
- Simple &lt; 0.3.0 recibe `{ rev, recipes: [] }` (contrato channel-types).
- `account_suspended`.
- Bridge change / wipe a simple **incrementa** `rev` (ya no usa 0 como flag).

## Hallazgos

### HIGH — Snapshot vacío pisa el árbol del Bridge (P4 vivo)

**Dónde:** `lib/parse.ts` `parseRooms`/`parseScenes` aceptan `[]`. `register` trata `[]` como válido (`!rooms` es false). `upsertBridge` siempre `snapshot = excluded.snapshot`.

**Impacto:** un XIAO con Clip v2 caído o parser que manda `rooms:[]`/`scenes:[]` **borra** grupos/escenas de **todos** los switches de ese `bridgeid` en esa cuenta. Decisión 2026-09-20 en `docs/problems.md`: last **good** snapshot wins; omitted = 400. Omitted hoy es 400; **vacío no**.

**Recomendación:** rechazar register si `lights+rooms+scenes` están todos vacíos cuando ya existe snapshot; o exigir rooms/scenes no vacíos salvo primer register. Firmware: no POST si Hue ≠ 200.

### HIGH — GET config es mutante y caro

**Dónde:** `app/api/device/config/route.ts`.

Antes del 204 el Round hace: `getSwitchByMac`, `getBridge`, `listPages`, `listRoundRecipes`, `persistPageGroupAndDim` (WRITE), posible `incrementSwitchRev`, `listPages` otra vez, `recordConfigPoll` (WRITE), `touchApiKey` vía auth (WRITE).

**Impacto:**
- Un poll «al día» igual pega writes a Neon.
- `persistPageGroupAndDim` puede reescribir `group`/`dim` **sin** subir `rev` → firmware con `localRev >= remote` **tira** esos campos (P11).
- Dos polls concurrentes pueden racing `rev`.

**Recomendación:** si `reported === sw.rev` y no hay ventana de editing, 204 + `recordConfigPoll` ligero **sin** persist ni segundo listPages. Si group/dim cambian de verdad, bump `rev`.

### MED — `registerLimitHit` TOCTOU

Count bridges/switches y luego upsert, sin transacción. Dos registers paralelos pueden pasar el cap.

### MED — `ensureSchema()` en cada poll/register

Ver [performance.md](./performance.md).

### MED — Product omitido + `channels: []`

`parseChannels(undefined) → []`. `parseProduct` solo acepta `round`/`simple`. Inferencia en `upsertSwitch`: si no hay product y el switch ya es round, se queda round (P5 mitigado). Un **nuevo** MAC con `channels:[]` y sin product se infiere **round**. `scripts/push-from-bridge.mjs` manda `channels: []` sin product — OK si no hay MAC; peligroso si alguien añade MAC.

**Recomendación:** exigir `product` en register nuevo. Simple y Round ya pueden enviarlo.

### LOW — Recipes GET en Round

`docs/problems.md` C16: GET `/recipes` → `[]`, PUT 400 `round_switch_uses_pages`. Confirmar UI no llama recipes en Round.

### LOW — 500 / 410 shape

C21: 500 `database_error` y 410 con `message` no están en la tabla de `docs/device-api.md`.
