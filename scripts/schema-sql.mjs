// Reads db/schema.sql, the only place the schema is written (docs/specs/finished/schema-version.md §2.2).
// Shared by scripts/gen-schema.mjs (build) and scripts/migrate.mjs (by hand).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const SCHEMA_FILE = new URL("../db/schema.sql", import.meta.url);

/**
 * Splits SQL into statements on ";" outside comments, quotes and $$ … $$ bodies. Comments are
 * dropped (a "--" comment may contain ";"); whitespace inside statements is kept.
 */
export function splitStatements(text) {
  const statements = [];
  let current = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("--", i)) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
      continue;
    }
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end === -1) throw new Error("unterminated $$ block in db/schema.sql");
      current += text.slice(i, end + 2);
      i = end + 2;
      continue;
    }
    if (text[i] === "'") {
      let end = i + 1;
      while (end < text.length && !(text[end] === "'" && text[end + 1] !== "'")) {
        end += text[end] === "'" ? 2 : 1;
      }
      current += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (text[i] === ";") {
      statements.push(current);
      current = "";
      i++;
      continue;
    }
    current += text[i];
    i++;
  }
  statements.push(current);
  return statements
    .map((statement) =>
      statement
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== "")
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

/** SHA-256 of the statements, first 16 hex characters. Any edit changes it. */
export function schemaVersion(statements) {
  return createHash("sha256").update(statements.join("\n;\n")).digest("hex").slice(0, 16);
}

export function readSchema() {
  const statements = splitStatements(readFileSync(SCHEMA_FILE, "utf8"));
  return { statements, version: schemaVersion(statements) };
}
