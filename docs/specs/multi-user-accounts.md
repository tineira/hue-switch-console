# Multi-user accounts

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** draft

## 1. What and why

The console is going open source, and one instance will be hosted for anyone to use. Today there is one account, created from `USER_EMAIL` / `USER_PASSWORD`, with no way to sign up, change a password or recover access. Afterwards:

- A person signs up and signs in with a **6-digit code emailed to them**. No passwords, so there is nothing to change, reset or leak.
- Sign-up on the hosted console is **invite-only** at first and can later be opened to everyone with one setting.
- A person can change their email, sign out on all devices and delete their account, including everything it owns.
- The operator (admin) can see accounts, suspend one, and issue invites.
- Fake accounts are held back at several layers (bot check, verified email, disposable-domain block, send limits), and **per-account limits** keep any account that gets through from costing much.
- Self-hosters keep today's setup: one seeded account with a password and no email provider.

The data model already scopes everything to `users(id)` with `on delete cascade`, so most of this work is in sign-in and sign-up, not in the tables that store switches and recipes.

## 2. Contract change

### 2.1 `docs/device-api.md` — additive

New error codes on device endpoints. No request or response field changes.

| Status | error | When |
| --- | --- | --- |
| 403 | `limit_reached` | `POST /api/device/register` would create a **new** switch or bridge beyond the account's limit. `details`: `"switches"` or `"bridges"`. Updates to switches and bridges that already exist are never refused. |
| 403 | `account_suspended` | The key's owner is suspended. Recipes in NVS keep running on the LAN (same as a revoked key). |
| 413 | `payload_too_large` | Register body over the snapshot size limit (§2.4). |
| 429 | `rate_limited` | Too many requests from one key or IP. `Retry-After` header in seconds. |

The **Auth** section's "No public signup" and "email + password" wording is replaced by a pointer to this spec: the human session is still the `hsw_session` cookie, obtained by an emailed code (hosted) or a password (self-hosted).

No change to NVS keys, `HUESET`, Improv or the installer.

### 2.2 Sign-in and sign-up (console only)

One form at `/login`: email → code → signed in. It handles sign-up too: if the email has no account and sign-up is allowed (§2.3), entering a valid code creates the account.

1. `POST` email (server action) with the Turnstile token when Turnstile is configured.
   - Checks, in order: Turnstile passes; the email is well-formed; its domain is not on the disposable list (only for new accounts); send limits (§2.5) are not exceeded; the email has an account **or** sign-up is allowed for it.
   - On success, a 6-digit code is stored as a hash in `login_codes` with a 10-minute expiry and emailed. Any older unused code for that email is invalidated.
   - The response is **the same** whether or not the email has an account ("If this address can sign in, we sent a code"), so the form cannot be used to find out who has an account. When sign-up is closed and the email has no account, no email is sent.
2. `POST` email + code.
   - At most 5 wrong attempts per code; then the code is invalidated.
   - On success: the code is marked used; the account is created if needed (consuming the invite, §2.3); `last_login_at` is set; the session cookie is set.

A link in the email (`/login/verify?token=…`) signs in with one tap as an alternative to typing the code. It uses the same row and limits.

**Password sign-in** stays only when the console has no email provider configured (self-hosted). With email configured, the password field is not shown and `password_hash` is ignored.

**Sessions.** The cookie format stays HMAC-signed, but its payload gains the user's `session_version`: `userId.version.exp.sig`. `getSessionUser` rejects a cookie whose version is not the current one, and rejects suspended users. "Sign out everywhere", email change and suspension increment `session_version`. Cookies in the old three-part format stay valid until they expire (at most 7 days), then stop being issued.

### 2.3 Sign-up modes

`SIGNUP_MODE` env var:

| Value | Who can create an account | Default for |
| --- | --- | --- |
| `closed` | Nobody. Only the seeded `USER_EMAIL` exists. | Self-hosted (no email provider) |
| `invite` | Someone with an unused, unexpired invite code | Hosted, at launch |
| `open` | Anyone who passes the checks in §2.2 | Hosted, later |

Invites are created by an admin in `/admin`: one-time codes (`inv_…`), optionally tied to one email, expiring after 14 days. The invite link is `/login?invite=inv_…`. The console shows the link to copy; it does not email invites in v1.

### 2.4 Per-account limits

Enforced in the console. Defaults, each overridable by env (`LIMIT_SWITCHES`, …):

| Resource | Limit | Where it is checked |
| --- | --- | --- |
| Switches | 25 | `POST /api/device/register` creating a new MAC → `403 limit_reached` |
| Bridges | 5 | `POST /api/device/register` with a new `bridgeid` → `403 limit_reached` |
| Active device API keys | 25 | `POST /api/keys` → `400 limit_reached` in the UI |
| Register body size | 512 KB | `POST /api/device/register` → `413 payload_too_large` |

A user who hits a limit sees why in the console (Devices shows a banner when the last register from a board was refused). The admin can raise the limit for one account (`users.limits` jsonb overrides).

### 2.5 Rate limits

- **Code sends:** 3 per email per 15 minutes; 10 per IP per hour; 200 in total per hour across the instance (to cap the email bill). Stored in Postgres (`auth_events`).
- **Code checks:** 5 wrong attempts per code (§2.2); 30 per IP per hour.
- **Device endpoints:** a Vercel Firewall rate-limit rule on `/api/device/*` per IP (config, not code), returning `429`. Boards call register at boot and config on a schedule, so a generous limit (e.g. 60/min per IP) never hits a real board.

### 2.6 Account page — new `/account`

- Current email; **change email**: sends a code to the *new* address, switches after it is verified, then signs out other sessions and sends a notice to the old address.
- **Sign out everywhere.**
- **Delete account**: type your email to confirm. Deletes the `users` row; the cascade removes keys, bridges, switches, pages and recipes. Boards keep their NVS recipes and get `401` on the next call, which they already handle.

### 2.7 Admin — new `/admin`

Admins are the emails in `ADMIN_EMAILS` (comma-separated). No role column: the operator controls it by env, and self-hosters are admin of their own seeded account.

- Accounts table: email, created, last sign-in, switches, bridges, last board seen, status. Sort by any column.
- Suspend / unsuspend (sets `suspended_at`, bumps `session_version`).
- Raise limits for one account.
- Create and revoke invites.
- The admin cannot read another account's recipes or topology from this page; it only shows counts.

### 2.8 Dormant accounts

A daily Vercel Cron job (`/api/cron/dormant`, protected by `CRON_SECRET`):

- An account with **no registered switch** and **no sign-in for 60 days** gets a warning email: "This account will be deleted in 14 days unless you sign in."
- 14 days after the warning, if still no sign-in and no switch, it is deleted.
- Accounts with any switch are never deleted automatically.
- Off when email is not configured (self-hosted).

### 2.9 Storage (`db/schema.sql`) — additive

```sql
alter table users alter column password_hash drop not null;
alter table users add column if not exists session_version integer not null default 1;
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists suspended_at timestamptz;
alter table users add column if not exists dormant_warned_at timestamptz;
alter table users add column if not exists limits jsonb not null default '{}'::jsonb;

create table if not exists login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('sign_in', 'change_email')),
  user_id uuid references users (id) on delete cascade,
  code_hash text not null,
  link_token_hash text not null unique,
  invite_id uuid,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists login_codes_email_idx on login_codes (email, created_at desc);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_prefix text not null,
  email text,
  created_by uuid references users (id) on delete set null,
  expires_at timestamptz not null,
  used_by uuid references users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth_events (
  id bigserial primary key,
  kind text not null check (kind in ('code_sent', 'code_failed')),
  email text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists auth_events_email_idx on auth_events (kind, email, created_at);
create index if not exists auth_events_ip_idx on auth_events (kind, ip, created_at);
```

`auth_events` rows older than 7 days are deleted by the same daily cron. Codes and invite codes are stored as SHA-256 hashes, like device keys.

### 2.10 Configuration

| Env var | Purpose | Unset means |
| --- | --- | --- |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending codes and notices | Password sign-in only; `SIGNUP_MODE` forced to `closed` |
| `SIGNUP_MODE` | §2.3 | `closed` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot check on the email form | No bot check |
| `ADMIN_EMAILS` | §2.7 | The seeded `USER_EMAIL` is admin |
| `CRON_SECRET` | §2.8 | Cron endpoint returns `503` |
| `LIMIT_SWITCHES`, `LIMIT_BRIDGES`, `LIMIT_KEYS`, `LIMIT_SNAPSHOT_KB` | §2.4 | Defaults above |

`USER_EMAIL` / `USER_PASSWORD` keep seeding the first account. The disposable-domain list comes from the `disposable-email-domains` npm package.

### 2.11 Legal pages

`/privacy` and `/terms`, shown on the hosted console and linked from `/login`. Their text comes from `PRIVACY_URL` / `TERMS_URL` if set (links out) or is omitted (self-hosted). Writing the text is the operator's job, not this spec's.

## 3. Compatibility

- **Boards that have not updated:** nothing changes for a board whose account is within its limits. Both firmwares treat any non-200 from the console as a failed call and retry on their normal schedule; only `401` sets the "key rejected" state (`hue-simple-switch/console.h` `consoleNoteHttp`, `hue-round-switch/console.h`). So `403`, `413` and `429` show up as a failed sync, and NVS recipes keep running. Before deploy, check that the existing account is below every limit (`select count(*) from switches`, `bridges`).
- **Board ahead of the console:** not applicable; no firmware change is needed.
- **Firmware versions that need the old path:** none.
- **The existing account** keeps its data and `id`. On the hosted console it signs in by emailed code to the same address; `password_hash` stays in the row but is not used.
- **Existing cookies:** the old three-part format stays valid until it expires (§2.2), so nobody is signed out by the deploy.
- **When the old path can be removed:** the three-part cookie reader can go 7 days after deploy. Nothing else is retired.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Schema (§2.9) in `db/schema.sql` and `lib/ensure-schema.ts`
- [ ] Email sending (`lib/email.ts`, Resend) with the code, change-email and dormant-warning templates, in English
- [ ] `/login`: email → code flow, link sign-in, Turnstile, disposable-domain check, send limits; password form only when email is not configured
- [ ] Sessions: `session_version` in the cookie, suspended check, old-format fallback
- [ ] `SIGNUP_MODE` and invites
- [ ] Per-account limits in `POST /api/device/register` and `POST /api/keys`; register body size limit; Devices banner for refused registers
- [ ] `/account`: change email, sign out everywhere, delete account
- [ ] `/admin`: accounts table, suspend, limits, invites
- [ ] Dormant-account cron and `auth_events` cleanup (`vercel.json` cron entry)
- [ ] Vercel Firewall rate-limit rule on `/api/device/*`
- [ ] `docs/device-api.md` updated in the same commit as the register limit (§2.1)
- [ ] `docs/definitions.md`: "User account", "No public signup" and the auth row updated
- [ ] `README.md`: env vars (§2.10) and self-hosting without email
- [ ] `docs/changelog.md` console entry
- [ ] Deployed; checked on production by the user (sign-in by code, invite sign-up, account deletion on a test account)

### Round (`hue-round-switch`)

- [ ] No change required. Optional later: show "account limit reached" on the display for `403 limit_reached`.

### Simple (`hue-simple-switch`)

- [ ] No change required.

### Cleanup

- [ ] Three-part cookie reader removed, at least 7 days after deploy

## 5. Open questions

1. **Build or buy sign-in.** This spec builds the email-code flow in the console (about the size of `lib/auth.ts` today) because sessions already exist and work, and a library such as Better Auth or Auth.js brings its own user and session tables and a migration of `users`. The cost: "Sign in with Google/GitHub" later means adding OAuth by hand or moving to a library then. OK to build?
2. **Limits.** Are 25 switches / 5 bridges / 25 keys / 512 KB the right defaults? What is the largest real snapshot today?
3. **Email provider.** Resend is assumed (a free tier covers early use). Which sending domain: `hue.tineira.com`, or a new domain for the public service?
4. **Waitlist.** With `invite`, should `/login` offer "request an invite" (stores the email for the admin) or just say sign-up is by invitation?
5. **Dormant deletion.** Is 60 days + 14 days notice right, or should v1 only list dormant accounts in `/admin` and leave deletion manual?
6. **Hosted domain.** Does the public service stay at `hue.tineira.com` (which is also `CONSOLE_URL` in firmware), or move? A move is a separate cross-repo change.
