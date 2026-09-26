import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

// Neon over HTTP by default. DATABASE_DRIVER=pg uses a plain Postgres connection
// instead (self-hosting on any Postgres, local development).

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Query = { text: string; values: unknown[] };
type Tag = (strings: TemplateStringsArray, ...values: unknown[]) => Query;

export type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  query(text: string, values?: unknown[]): Promise<Row[]>;
  transaction(build: (tx: Tag) => Query[]): Promise<Row[][]>;
};

function toQuery(strings: TemplateStringsArray, values: unknown[]): Query {
  let text = strings[0] ?? "";
  for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
  return { text, values };
}

let pool: Pool | null = null;

function pgClient(url: string): SqlClient {
  if (!pool) pool = new Pool({ connectionString: url, max: 5 });
  const db = pool;
  const run = async (text: string, values: unknown[] = []) => (await db.query(text, values)).rows;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = toQuery(strings, values);
    return run(q.text, q.values);
  }) as SqlClient;
  client.query = run;
  client.transaction = async (build) => {
    const queries = build((strings, ...values) => toQuery(strings, values));
    const conn = await db.connect();
    try {
      await conn.query("begin");
      const results: Row[][] = [];
      for (const q of queries) results.push((await conn.query(q.text, q.values)).rows);
      await conn.query("commit");
      return results;
    } catch (err) {
      await conn.query("rollback");
      throw err;
    } finally {
      conn.release();
    }
  };
  return client;
}

export function sql(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (process.env.DATABASE_DRIVER === "pg") return pgClient(url);
  return neon(url) as unknown as SqlClient;
}
