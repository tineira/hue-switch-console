/**
 * Seeds the first console user. No public signup.
 *   npx vercel env run -- node scripts/seed-user.mjs
 */
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
const email = process.env.USER_EMAIL?.trim().toLowerCase();
const password = process.env.USER_PASSWORD;
if (!url || url.includes("[SENSITIVE]") || !email || !password) {
  console.error("Need DATABASE_URL, USER_EMAIL, USER_PASSWORD");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32);
const stored = `${salt.toString("hex")}:${hash.toString("hex")}`;
const sql = neon(url);
const existing = await sql`select id from users where email = ${email} limit 1`;
if (existing.length > 0) {
  console.log(`already exists: ${email}`);
  process.exit(0);
}
await sql`insert into users (email, password_hash) values (${email}, ${stored})`;
console.log(`seeded ${email}`);
