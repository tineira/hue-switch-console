# Device API

Contrato: `docs/device-api.md`. Rutas vivas:

- `POST /api/device/register` — Bearer device key
- `GET  /api/device/config?mac=&rev=`
- `PUT  /api/switches/{mac}/recipes` (Simple)
- `PUT  /api/switches/{mac}/pages` (Round)
- `POST /api/ingest` → **410**

Auth: `authenticateDevice` → hash sha256 → `device_api_keys` activas → `users.banned`.

Todas las lecturas de switches de usuario usan `getSwitchByMac(user.id, mac)`. No se vio IDOR de MAC entre cuentas.

## HIGH — Poll GET con side effects

Ver 02-seguridad.md y 08-rendimiento.md. En Round, aunque el board mande `rev` igual al servido:

1. `getSwitchByMac` + `getBridge` + `listPages` + `listRoundRecipes`
2. `persistPageGroupAndDim` (write)
3. a veces `incrementSwitchRev`
4. `listPages` otra vez
5. `recordConfigPoll` (write)
6. a veces 204

`docs/problems.md` P11: persistir group/dim **sin** bump de rev hace que firmware con `localRev >= remote` ignore el cambio. Sigue siendo el diseño actual (`persistPageGroupAndDim` luego `incrementSwitchRev` solo si `persisted`).

## HIGH — P4 snapshot vacío pisa el bridge

`parseRooms` / `parseScenes` aceptan `[]`. El check `if (!rooms || !scenes)` trata `[]` como válido. `upsertBridge` **siempre** sobreescribe `bridges.snapshot`.

Un register malformado o un firmware viejo que mande listas vacías borra luces/habitaciones/escenas para **todos** los switches de ese `bridgeid` en esa cuenta.

**Fix:** rechazar snapshot “vacío” si ya hay uno no vacío; o merge; o exigir `lights.length + rooms.length > 0` salvo primer alta.

P3 (rev=0 al cambiar bridge) y P5 (wipe a simple por inferencia) están **corregidos** en código 2026-09-27: wipe de pages solo si `existing.product === "round" && product === "simple"` explícito.

## MED — TOCTOU de límites

`registerLimitHit` cuenta y después `upsertSwitch` / `upsertBridge` fuera de transacción. Dos registers en paralelo pueden pasar el cap. Igual en `POST /api/keys` (`activeKeyCount` luego `insertApiKey`).

## MED — 500 con `details`

Igual que el resto de la API.

## MED — Simple firmware < 0.3.0

Config responde `{ rev, recipes: [] }` y `hasConfig = true`. La placa no recibe recetas hasta reflash. Correcto según spec; el admin no ve “esta placa está en modo vacío a propósito”.

## LOW

- `GET /api/switches/{mac}` devuelve `{ found: false }` en vez de 404 (intencional para el UI?).
- `touchApiKey` en cada poll: write extra.
- `channels` omitidos → `[]` (`parseChannels`).

## GOOD

- MAC normalizada a 12 hex.
- Product `simple|round` con check SQL.
- Suspended corta el dispositivo sin borrar recetas.
- Ingest muerto.
- Pages PUT valida contra snapshot (`validateRoundConfig`) y marca `editing_until`.
