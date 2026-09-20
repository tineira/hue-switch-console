/**
 * Creates the seeded console user (email + password). No public signup.
 *
 *   npm run seed-user
 */
function env(name) {
  let value = process.env[name];
  if (
    value &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const email = env("USER_EMAIL")?.trim();
const password = env("USER_PASSWORD");

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL, USER_PASSWORD",
  );
  process.exit(1);
}

const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
  }),
});

const body = await res.text();
if (res.ok) {
  console.log(`seeded ${email}`);
  process.exit(0);
}

const lower = body.toLowerCase();
if (
  res.status === 422 ||
  lower.includes("already") ||
  lower.includes("registered") ||
  lower.includes("exists")
) {
  console.log(`already exists: ${email}`);
  process.exit(0);
}

console.error(`seed failed ${res.status} ${body}`);
process.exit(1);
