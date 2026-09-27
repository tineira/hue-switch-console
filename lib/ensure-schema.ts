import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from "@/lib/generated/schema";
import { dropLegacySimpleRecipes, migrateLegacyRoundSwitches } from "@/lib/db";
import { sql } from "@/lib/sql";

// The schema lives in db/schema.sql (generated into lib/generated/schema.ts). A cold start reads
// the version the database last applied and runs the statements only when the code's differs
// (docs/specs/finished/schema-version.md §2.3).

let running: Promise<void> | null = null;

async function storedVersion(): Promise<string | null> {
  try {
    const rows = await sql()`select version from schema_meta where id`;
    return (rows[0] as { version?: string } | undefined)?.version ?? null;
  } catch {
    // No schema_meta yet: a new database, or one from before this check.
    return null;
  }
}

/** Every statement, then the one-off data migrations, then the version. Idempotent. */
export async function applySchema() {
  const db = sql();
  for (const statement of SCHEMA_STATEMENTS) {
    await db.query(statement);
  }
  await migrateLegacyRoundSwitches();
  await dropLegacySimpleRecipes();
  // Written last: a run that failed part-way is retried by the next cold start.
  await db`
    insert into schema_meta (id, version, applied_at) values (true, ${SCHEMA_VERSION}, now())
    on conflict (id) do update set version = excluded.version, applied_at = excluded.applied_at
  `;
}

async function check() {
  if ((await storedVersion()) === SCHEMA_VERSION) return;
  await applySchema();
}

export async function ensureSchema() {
  if (!running) {
    running = check().catch((err) => {
      running = null;
      throw err;
    });
  }
  return running;
}
