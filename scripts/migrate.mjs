// Applies db/schema.sql by hand (docs/specs/schema-version.md §2.4). The console also applies it on
// its own at the first request after a schema change; this is for setting up a database ahead of
// time. It leaves schema_meta alone, so the first request still runs the data migrations (they
// live in TypeScript, lib/db.ts) and records the version.
import { neon } from "@neondatabase/serverless";
import pg from "pg";
import { readSchema } from "./schema-sql.mjs";

const url = process.env.DATABASE_URL;
if (!url || url.includes("[SENSITIVE]")) {
  console.error("DATABASE_URL is missing. Use: npx vercel env run -- node scripts/migrate.mjs");
  process.exit(1);
}

const { statements, version } = readSchema();

let run;
let close = async () => {};
if (process.env.DATABASE_DRIVER === "pg") {
  // Same sslmode handling as lib/sql.ts pgConnectionString.
  const connectionString = url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/, "$1verify-full");
  const pool = new pg.Pool({ connectionString, max: 1 });
  run = (text) => pool.query(text);
  close = () => pool.end();
} else {
  const sql = neon(url);
  run = (text) => sql.query(text);
}

try {
  for (const statement of statements) {
    await run(statement);
  }
  console.log(`schema applied (${statements.length} statements, version ${version})`);
} finally {
  await close();
}
