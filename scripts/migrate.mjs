import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url || url.includes("[SENSITIVE]")) {
  console.error("DATABASE_URL is missing. Use: npx vercel env run -- node scripts/migrate.mjs");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(";")
  .map((part) =>
    part
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);
for (const statement of statements) {
  await sql.query(statement);
}
console.log(`schema applied (${statements.length} statements)`);
