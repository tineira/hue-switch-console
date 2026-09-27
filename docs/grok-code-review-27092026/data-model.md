# Data model

**Fuentes:** `db/schema.sql`, `lib/ensure-schema.ts`, `lib/db.ts`, `lib/limits.ts`, `lib/sql.ts`.

## Bien hecho

- Tenancy por `user_id` en bridges/switches/keys. Lookups de dispositivo usan `(user_id, mac)` / `(user_id, bridgeid)`.
- Device keys: `key_hash` único; índice parcial de keys activas por user.
- Recipes: unique parcial Simple vs Round (`recipes_simple_uniq` / `recipes_round_uniq`).
- `simple_channels` es la fuente de Simple; recipes de Simple se derivan en el poll.
- Firmware: unique `(product, version)`, parts con sha256 + tamaño, `firmware_current` de una fila por producto.
- Invites hasheados; waitlist unique parcial en pending email.
- `console_settings` singleton (`id boolean primary key check (id)`).
- Cascades: borrar user limpia sessions, accounts, keys, bridges, switches, pages, recipes.
- `upsertSwitch` (hoy): cambio de `bridgeid` sube `rev` a `existing.rev + 1` y borra pages/recipes/simple_channels. Wipe round→simple solo con `product: "simple"` explícito.

## Hallazgos

### HIGH / MED — Snapshot vacío pisa el árbol del Bridge (P4 vivo)

**Dónde:** `upsertBridge` siempre `snapshot = excluded.snapshot`. `parseRooms` / `parseScenes` aceptan `[]`. Register exige arrays pero `[]` es válido.

**Impacto:** un XIAO o `push-from-bridge` que POSTEA `rooms: []` / `scenes: []` (Hue caído, parse fallido) borra grupos y escenas para **todos** los switches de ese `bridgeid` del mismo user. Decisión de `docs/problems.md` §5.4: last *good* snapshot wins — no implementada.

**Recomendación:** 400 si `rooms` o `scenes` omitidos o vacíos cuando el bridge ya tiene árbol; o no actualizar snapshot si lights+rooms+scenes están todos vacíos.

### MED — `sql().transaction` vs Neon HTTP

**Dónde:** `lib/sql.ts` — con `DATABASE_DRIVER=pg` hay `transaction()`. Default: `return neon(url) as unknown as SqlClient`. `lib/firmware.ts` `uploadRelease` llama `db.transaction((tx) => Query[])`.

**Impacto:** la API de `@neondatabase/serverless` `neon().transaction` no coincide con el wrapper `build => Query[]`. En prod Neon HTTP el upload podría fallar o no ser atómico (release sin parts, o parts sin current). Si los uploads de CI funcionan hoy, verificar qué driver usa Vercel.

**Recomendación:** un solo cliente con `transaction` real en ambos drivers; test de upload contra Neon HTTP.

### MED — Bins en `bytea` dentro de Neon

**Dónde:** `firmware_parts.data`. `/admin` estima uso vs 0.5 GB free.

**Impacto:** cada release = bootloader + partitions + boot_app0 + firmware. Se guardan 5 versiones con parts (`KEEP_RELEASES_WITH_PARTS`) más la current. Backups y `pg_dump` crecen. `readPart` hace `encode(..., 'base64')` en SQL y decode en Node — doble copia en memoria.

**Recomendación:** object storage (R2/Blob) + DB solo metadatos/sha256. Mientras tanto, límite de tamaño por part.

### MED — `ensure-schema.ts` corre DDL en el request path

**Dónde:** casi todas las rutas llaman `ensureSchema()` (device poll incluido).

**Impacto:** primer isolate ejecuta ~70 statements + migraciones legacy. Siguientes esperan la Promise en memoria (se pierde en cold start). `DROP CONSTRAINT` / `ADD CONSTRAINT` en cada arranque es lock-friendly en IF NOT EXISTS, pero no es barato. Dos fuentes de schema (`schema.sql` vs array en ensure-schema) pueden volver a divergir.

**Recomendación:** migrar solo con `npm run migrate` en deploy; en request, no-op o `SELECT 1` de versión.

### LOW — Columnas muertas `pages.dim_target_rtype` / `dim_target_rid`

Comentario en schema: leftover pre-§8.2. Confunde agentes. DROP cuando no quede código que las toque (hoy no se leen).

### LOW — `users.role` no es fuente de verdad

Se escribe en cada login desde `isAdminEmail()`. `requireAdmin` mira `ADMIN_EMAILS` / `USER_EMAIL`. Un admin en DB que salga de la env queda `role=user` al entrar. Ver [auth-admin.md](./auth-admin.md).

### LOW — Límites por cuenta

`users.limits` jsonb libre. `effectiveLimits` solo aplica keys `switches|bridges|keys|snapshotKb` con `value > 0`. `registerLimitHit` cuenta luego inserta (TOCTOU). No hay unique/constraint de «no más de N switches» a nivel DB.

`limitsAction` en admin sí filtra keys; `setLimits` en `lib/admin.ts` aceptaría cualquier objeto si se llama desde otro sitio.

### LOW — `listAccounts` LIMIT 1000 + 3 subqueries correlacionadas

Sin búsqueda. Crecimiento lineal por cuenta. Ver [admin-gaps.md](./admin-gaps.md).

### NIT — Dual schema

`schema.sql` tiene bloque DO $$ para `password_hash` legacy; ensure-schema también. CHECKs de product/axis/timeout están en ambos (P17 de problems.md está **stale**).

Regex de versión firmware: en schema `'^\d+\.\d+\.\d+$'`; en ensure-schema string JS `'^\\d+\\.\\d+\\.\\d+$'` — correcto al ejecutar SQL.
