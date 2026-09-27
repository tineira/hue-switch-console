# Schema check once per version

Console-only spec. Process: `AGENTS.md` → "Cross-repo changes". Tracked in `docs/problems.md` §6a ("`ensureSchema()` in the request path").

**Status:** done (2026-09-27). Deployed; production recorded version `fb6036bc6a16c103` in `schema_meta`.

## 1. What and why

Almost every route calls `ensureSchema()` first, the device poll and register included (17 files). It is cached per process, but each cold start runs all 81 schema statements one after another before it answers, plus two data migrations. On Neon over HTTP each statement is a round trip, so a switch whose poll lands on a cold instance waits about one to two seconds longer, and the database does DDL work each time. It never changes anything once a schema is in place.

Afterwards:

- A cold start costs **one query**: read the stored schema version and compare it with the code's. Only a deploy that changes the schema runs the statements, once.
- There is **one source** for the schema. Today `db/schema.sql` (used by `npm run migrate`) and the array in `lib/ensure-schema.ts` (used at runtime) are kept in step by hand, and they have drifted before (old P17). `migrate` also skips the two data migrations that only the runtime runs.
- Self-hosting stays zero-step: a fresh database still gets its schema on the first request. `npm run migrate` keeps working.

## 2. Contract change

### 2.1 `docs/device-api.md`: none

No endpoint, payload, NVS, `HUESET`, Improv or installer change. Boards see only a faster first answer after a deploy.

### 2.2 One source: `db/schema.sql`

- `db/schema.sql` becomes the only place statements are written. Its comments stay.
- A `prebuild` script (next to `scripts/credits.mjs`) splits it into statements with the splitter `scripts/migrate.mjs` already has, and writes `lib/generated/schema.ts`:
  - `SCHEMA_STATEMENTS: string[]`
  - `SCHEMA_VERSION: string`, the SHA-256 of the statements, first 16 hex characters. Any edit to the schema changes it; nobody bumps a number by hand.
- The generated file is committed, like `lib/generated/console-credits.json`, so `next dev` and `tsc` work without a build first.
- CI (`.github/workflows/ci.yml`) regenerates it and fails when the committed file differs, so an edit to `schema.sql` without regenerating cannot ship.
- `lib/ensure-schema.ts` loses its own array and imports the generated one.
- Before the switch, the two lists are reconciled: every statement the runtime array has and `schema.sql` lacks moves into `schema.sql`, in the same order. The first deploy then runs the same statements production runs today.

### 2.3 Stored version

New table:

```sql
create table if not exists schema_meta (
  id boolean primary key default true check (id),
  version text not null,
  applied_at timestamptz not null default now()
);
```

`ensureSchema()` per process:

1. `select version from schema_meta`. If the table is missing (first run on a new database or on today's production), or the version differs, go to 2. If it matches, done.
2. Run every statement, then the data migrations (`migrateLegacyRoundSwitches`, `dropLegacySimpleRecipes`), then upsert `schema_meta` with the new version.

Two instances starting at once may both run step 2. That is already true today and is safe: every statement is idempotent (`if not exists`, `drop … if exists` before `add`). The version is written only after everything succeeded, so a failed run is retried by the next cold start, as today (`running = null` on error).

### 2.4 `npm run migrate`

Runs the same statements, read from `db/schema.sql` through the same splitter (no build needed), and honors `DATABASE_DRIVER=pg` (it used to always use Neon's HTTP driver). It does **not** write `schema_meta`: `migrateLegacyRoundSwitches` has per-switch logic in TypeScript that a plain Node script cannot run, so the first request after a `migrate` still runs the data migrations and records the version, once.

The old splitter also cut a statement in two when an inline `--` comment held a `;` (the `console_settings` table), so `migrate` could not apply the schema as it stood. The shared splitter skips comments and quotes.

### 2.5 Storage (`db/schema.sql`), additive

The `schema_meta` table (§2.3). Nothing is dropped.

## 3. Compatibility

- Console behavior with a board that has not updated: unchanged. No device path changes.
- Board behavior with a console that has not deployed: not applicable.
- Firmware versions that need the old path: none.
- The first deploy finds no `schema_meta` row, runs the full schema once (as every cold start does today), and records the version. After that, cold starts cost one query.
- Rollback to a deploy from before this change works: that code ignores `schema_meta` and runs its own statements.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Runtime array reconciled into `db/schema.sql` (same statements, same order) (§2.2)
- [x] `prebuild` generator writes `lib/generated/schema.ts` (`SCHEMA_STATEMENTS`, `SCHEMA_VERSION`); file committed (§2.2)
- [x] CI fails when the generated file is stale (§2.2)
- [x] `ensureSchema()` checks `schema_meta` first; applies and records only on a new version (§2.3)
- [x] `npm run migrate` uses the shared splitter and `DATABASE_DRIVER=pg`; leaves the version to the first request (§2.4)
- [x] Tested on a local Postgres: fresh database, today's production schema, a matching version (one query), a changed statement (re-applies), a failed statement (version not written)
- [x] `README.md` "Firmware release pipeline" and the new-product notes point to `db/schema.sql` only
- [x] `docs/device-api.md`: no change
- [x] Deployed; checked on production (Neon: `schema_meta` has the version; a device request answers normally)

### Round (`hue-round-switch`)

Nothing to do.

### Simple (`hue-simple-switch`)

Nothing to do.

### Cleanup

- [x] `docs/problems.md` §6a row closed

## 5. Decisions (2026-09-27)

1. **When the schema runs:** the lazy check (§2.3), not a migration during the Vercel build. One query per cold start either way; self-hosters need no extra step; a Preview build never migrates a database.
2. **Data migrations:** once per schema version, in the apply step, not on every cold start.
3. **Deleting the data migrations:** not in this change. A later cleanup, after checking `switches.firmware` for pre-pages Round or Simple < 0.3.0.
