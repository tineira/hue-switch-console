/**
 * Seeds the first console user with a password sign-in. The console also does this
 * on its own when /login first loads.
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
const [user] = await sql`
  insert into users (email, email_verified) values (${email}, true) returning id
`;
await sql`
  insert into accounts (user_id, account_id, provider_id, password)
  values (${user.id}, ${user.id}, 'credential', ${stored})
`;
console.log(`seeded ${email}`);
