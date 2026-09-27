import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url || url.includes("[SENSITIVE]")) {
  console.error("DATABASE_URL is missing. Use: npx vercel env run -- node scripts/migrate.mjs");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// Split on ";" outside $$ … $$ blocks (the schema has a DO block).
function splitStatements(text) {
  const parts = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("$$", i)) {
      inDollar = !inDollar;
      current += "$$";
      i++;
      continue;
    }
    if (text[i] === ";" && !inDollar) {
      parts.push(current);
      current = "";
      continue;
    }
    current += text[i];
  }
  parts.push(current);
  return parts;
}

// Drop "--" comment lines first: a comment may contain ";".
const withoutComments = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const statements = splitStatements(withoutComments)
  .map((part) => part.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`schema applied (${statements.length} statements)`);
