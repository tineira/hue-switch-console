# Base de datos y schema

## Forma

Un Postgres (Neon en hosted). Schema dual: `db/schema.sql` (referencia) y `lib/ensure-schema.ts` (lo que corre en cada isolate la primera vez). No hay migraciones versionadas en prod: `npm run migrate` existe para self-host.

## HIGH / MED

### ensureSchema en el hot path

`applySchema()` ejecuta decenas de `CREATE`/`ALTER`/`DROP CONSTRAINT` + `migrateLegacyRoundSwitches` + `dropLegacySimpleRecipes`. Memoizado por isolate (`running`). Cada cold start de Vercel lo vuelve a correr. En el poll de dispositivos eso es latencia y locks DDL en Neon.

**Fix:** migrar en deploy (`migrate` en CI/release) y dejar `ensureSchema` solo para self-host primer boot.

### Drift schema.sql vs ensure-schema

P17 de `problems.md` está **parcialmente stale**: ensure-schema ya tiene CHECKs de product/axis/timeout. Quedan diferencias menores de escape en el regex de `firmware_releases.version` (`\\\\d` en JS vs `\\d` en SQL). Conviene una sola fuente.

### leftover `pages.dim_target_*`

Comentado “do not read, DROP later”. Ocupa filas y confunde reviewers.

### firmware `bytea` en Neon Free

Cada release = 4 blobs. Keep 5 + current. El admin muestra “% of Neon 0.5 GB” porque esto es el riesgo real.

### `bridges.snapshot` jsonb

Un overwrite vacío (P4) es pérdida de datos compartida. No hay historial de snapshots.

### Invites / waitlist

Unique parcial `invite_requests (lower(email)) WHERE pending`. Bien. No hay unique global: el mismo mail puede tener filas approved+pending históricas.

Race de invite: `findUsableInvite` + create user + `consumeInvite` no es una transacción. El segundo `used_at IS NULL` pierde; pueden nacer dos users con un código. MED.

## Índices

Hay índices razonables (`switches(user,bridge)`, `pages(switch,sort)`, `device_api_keys` activas, `auth_events` por kind+email+time). Falta uno obvio para `switches(user_id, last_seen_at)` si admin va a ordenar por “last board seen” en SQL.

## GOOD

- FKs con `on delete cascade` en datos de usuario.
- Checks de MAC, product, timeout, event/action.
- Unique parcial Simple vs Round en `recipes`.
- Singleton `console_settings`.
- Password viejo `users.password_hash` se mueve a `accounts` y se dropea.
