# Multi-user accounts

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** in progress. Live on production with Google, GitHub and emailed-code sign-in (email since 2026-09-27); password sign-in is off, sign-up is invite-only. **TODO:** the email checks on production (see the checklist).

## 1. What and why

The console is going open source, and one instance will be hosted as a free service for anyone to use. Today there is one account, created from `USER_EMAIL` / `USER_PASSWORD`, with no way to sign up, change a password or recover access. Afterwards:

- A person signs up and signs in with **Continue with Google** or **Continue with GitHub**, or with a **6-digit code emailed to them**. No passwords, so there is nothing to change, reset or leak.
- Sign-up on the hosted console is **invite-only** at first and can later be opened to everyone with one setting. Someone without an invite can request one from `/login`.
- A person can change their email, sign out on all devices and delete their account, including everything it owns.
- The operator (admin) can see accounts, suspend one, issue invites and approve invite requests.
- Fake accounts are held back at several layers (bot check, verified email, disposable-domain block, send limits), and **per-account limits** keep any account that gets through from costing much.
- The hosted service fits the free tiers of Vercel Hobby, Neon, Resend and Cloudflare Turnstile at launch (§2.11).
- Self-hosters keep today's setup: one seeded account with a password, and no email provider or OAuth app needed.

Sign-in is built on **[Better Auth](https://www.better-auth.com)**, an open-source library that runs inside the console against the same Postgres (§2.2). It is not a hosted service: nothing to sign up for, for the operator or for self-hosters.

The data model already scopes everything to `users(id)` with `on delete cascade`. Better Auth uses the existing `users` table as its user table (§2.9), so `id`s and the tables that store switches and recipes do not move.

## 2. Contract change

### 2.1 `docs/device-api.md` — additive

New error codes on device endpoints. No request or response field changes.

| Status | error | When |
| --- | --- | --- |
| 403 | `limit_reached` | `POST /api/device/register` would create a **new** switch or bridge beyond the account's limit. `details`: `"switches"` or `"bridges"`. Updates to switches and bridges that already exist are never refused. |
| 403 | `account_suspended` | The key's owner is suspended. Recipes in NVS keep running on the LAN (same as a revoked key). |
| 413 | `payload_too_large` | Register body over the snapshot size limit (§2.4). |
| 429 | `rate_limited` | Too many requests from one key or IP. `Retry-After` header in seconds. |

**Idle poll: 300 s → 900 s.** The `X-Poll-Sec` value for a switch that has its config, is not behind, and whose owner is not on the Switches page goes from 300 s to **900 s** (`POLL_IDLE_SEC` in `lib/config-sync.ts`). The 30 s fast poll is unchanged. Firmware already accepts 30–3600 s, so no firmware change is needed. Why: at 300 s one online board keeps the database from ever sleeping (Neon suspends after 5 min idle) and costs about 8,600 function calls a month; 900 s lets it sleep and triples how many boards the free tier holds (§2.11). Side effect: a saved change reaches an idle switch within 15 minutes instead of 5, and opening the Switches page switches a board to fast polling only at its next poll, so up to 15 minutes later.

The **Auth** section's "No public signup" and "email + password" wording is replaced by a pointer to this spec: the human session is a Better Auth session cookie, obtained by Google, GitHub or an emailed code (hosted) or a password (self-hosted).

No change to NVS keys, `HUESET`, Improv or the installer.

### 2.2 Sign-in and sign-up (console only)

**Library.** Better Auth (`better-auth` npm package), mounted at `/api/auth/[...all]`, using the console's Postgres. It signs cookies with the existing `AUTH_SECRET`. Features used:

| Better Auth feature | For |
| --- | --- |
| Email OTP plugin | 6-digit code by email for sign-in and sign-up; 10-minute expiry; at most 5 wrong attempts per code |
| Social providers: Google, GitHub | "Continue with …" buttons, each shown only when its client ID and secret are set |
| Account linking (trusted: Google, GitHub) | Signing in with Google and with an emailed code for the same verified address reaches the **same** account |
| Email and password | Self-hosted only, when no email provider is configured |
| Rate limiter, database storage | Per-IP limits on the OAuth callback endpoints |
| Database hooks | Sign-up gate (§2.3), disposable-domain block, suspended check, admin role, `last_login_at` |

**As built.** Every sign-in step except the OAuth return trip runs in server actions that call `auth.api.*` after checking Turnstile (`lib/turnstile.ts`) and the send limits (`lib/auth-limits.ts`). `/api/auth/[...all]` serves only `/api/auth/callback/*` and `/api/auth/error` and answers `404` to every other Better Auth path, so the checks cannot be skipped by calling the library's endpoints directly. For the same reason Turnstile and suspension are done in the console rather than with Better Auth's Captcha and Admin plugins: suspension is `users.banned`, checked when a session is created, when a session is read, and on device calls.

Before building, check that the current Better Auth release supports this project's Next.js (16.3) and read `node_modules/next/dist/docs/` for the route handler and request-interception conventions it needs.

**`/login`** shows, top to bottom: Continue with Google, Continue with GitHub (each only if configured), then the email → code form. One form handles sign-up too: if the email has no account and sign-up is allowed for it (§2.3), a valid code creates the account.

1. Send code (email + Turnstile token).
   - Checks, in order: Turnstile passes; the email is well-formed; send limits (§2.5) are not exceeded.
   - A code is sent only if the email has an account that is not suspended, **or** sign-up is allowed for it. A suspended account gets no code (and no email is spent), with the same reply as any other address. For a new account the domain must also not be on the disposable list.
   - The response is **the same** either way ("If this address can sign in, we sent a code"), so the form cannot be used to find out who has an account.
2. Verify code. On success the account is created if needed (consuming the invite, §2.3), `last_login_at` is set, and the session cookie is set.

Google and GitHub go through the same sign-up gate: a new account from either one needs sign-up to be allowed for that email, or it is refused with "Sign-up is by invitation for now." Both providers return verified emails, so no code is needed.

v1 sends a code only, not a one-tap link.

**Password sign-in** exists only when the console has no email provider configured (self-hosted). With email configured, the password form is not shown and password sign-in is disabled.

**Sessions** are Better Auth's: a row in `sessions` and an HTTP-only cookie, 7-day expiry refreshed while in use. `getSessionUser` in `lib/auth.ts` becomes a wrapper around Better Auth's session lookup, so pages and routes that call it do not change. A suspended (banned) user's sessions are revoked and new sign-ins are refused. The old `hsw_session` cookie is not read after deploy (§3).

Device API keys (`hsw_…` bearer keys) are not part of Better Auth and do not change.

### 2.3 Sign-up modes

`SIGNUP_MODE` env var:

| Value | Who can create an account | Default for |
| --- | --- | --- |
| `closed` | Nobody. Only the seeded `USER_EMAIL` exists. | Self-hosted (no email provider) |
| `invite` | Someone with an unused, unexpired invite | Hosted, at launch |
| `open` | Anyone who passes the checks in §2.2 | Hosted, later |

The gate is one Better Auth `user.create.before` database hook, so it applies to every sign-in method.

Invites are created by an admin in `/admin`: one-time codes (`inv_…`), optionally tied to one email, expiring after 14 days. The invite link is `/login?invite=inv_…`. Opening it stores the code in a short-lived cookie that the sign-up hook reads, so it works for Google, GitHub and the emailed code alike. An invite tied to an email only works for that email. An invite the admin creates by hand is shown as a link to copy and is not emailed.

**Invite requests.** With `invite`, `/login` has a "Request an invite" form: email plus an optional note (up to 500 characters), with the same Turnstile check and disposable-domain check as the code form, and the limits in §2.5.

- The request is stored in `invite_requests`. The response is always "Thanks, we'll email you if a spot opens", including when the email already has an account or a pending request (then nothing new is stored), so the form cannot be used to find out who has an account.
- `/admin` lists pending requests. **Approve** creates an invite tied to that email and **emails the invite link** to the requester. **Dismiss** marks the request dismissed and sends nothing.
- The admin is not emailed about new requests.
- Pending and dismissed requests older than 90 days are deleted by the daily cron (§2.8).
- The form is not shown with `closed` or `open`.

### 2.4 Per-account limits

Enforced in the console. Defaults, each overridable by env (`LIMIT_SWITCHES`, …):

| Resource | Limit | Where it is checked |
| --- | --- | --- |
| Switches | 25 | `POST /api/device/register` creating a new MAC → `403 limit_reached` |
| Bridges | 5 | `POST /api/device/register` with a new `bridgeid` → `403 limit_reached` |
| Active device API keys | 25 | `POST /api/keys` → `400 limit_reached` in the UI |
| Register body size | 512 KB | `POST /api/device/register` → `413 payload_too_large` |

A user who hits a limit sees why in the console (Setup and Switches show a banner for 7 days after a register from a board was refused). The admin can raise the limit for one account (`users.limits` jsonb overrides).

### 2.5 Rate limits

- **Code sends:** 3 per email per 15 minutes; 10 per IP per hour; **90 per day in total** across the instance, to stay under Resend's free 100 a day (`EMAIL_DAILY_CAP`, default 90). Invite and change-email messages count toward the daily total. Per-email and instance counts are kept in `auth_events`; per-IP limits use Better Auth's rate limiter.
- **Code checks:** 5 wrong attempts per code (§2.2); 30 per IP per hour.
- **Invite requests:** 3 per IP per hour; 50 in total per day across the instance.
- **Device endpoints:** the Vercel Firewall rate-limit rule on `/api/device/*` per IP (config, not code; Hobby allows one such rule), returning `429`. Boards call register at boot and config on a schedule, so a generous limit (e.g. 60/min per IP) never hits a real board.

When the daily email cap is reached, the code form says "Email sign-in is busy, try again later or continue with Google." Google and GitHub sign-in send no email and are not affected.

### 2.6 Account page — new `/account`

- Current email and linked sign-in methods (Google, GitHub, email).
- **Change email**: sends a code to the *new* address, switches after it is verified, then signs out other sessions and sends a notice to the old address.
- **Sign out everywhere**: revokes all sessions.
- **Delete account**: type your email to confirm. Deletes the `users` row; the cascade removes sessions, linked accounts, keys, bridges, switches, pages and recipes. Boards keep their NVS recipes and get `401` on the next call, which they already handle.

### 2.7 Admin — new `/admin`

Admins are the emails in `ADMIN_EMAILS` (comma-separated). The operator controls it by env, and self-hosters are admin of their own seeded account. A session hook stores `role` = `admin` for those emails at sign-in and `user` for everyone else, so the table shows who is admin; `/admin` itself checks `ADMIN_EMAILS`.

- Accounts table: email, sign-in methods, created, last sign-in, switches, bridges, last board seen, status. Sort by any column. A **Dormant** filter (§2.8).
- Suspend / unsuspend (`users.banned`: deletes the account's sessions, refuses sign-in; device calls get `403 account_suspended`).
- Delete an account (type its email to confirm; same cascade as §2.6).
- Raise limits for one account.
- Create and revoke invites.
- Invite requests: approve (emails the invite) or dismiss (§2.3).
- The admin cannot read another account's recipes or topology from this page; it only shows counts. There is no impersonation.

### 2.8 Dormant accounts and cleanup

v1 only **lists** dormant accounts; it never deletes one on its own.

- An account is dormant when it has **no registered switch** and **no sign-in for 60 days**. `/admin` shows these under the Dormant filter, and the admin deletes them by hand if they want to.
- No warning emails and no automatic deletion in v1. Adding them later is its own change (warning email, a `dormant_warned_at` column, a notice period).

A daily Vercel Cron job (`/api/cron/cleanup`, protected by `CRON_SECRET`; Hobby allows daily crons) does housekeeping only: it deletes `auth_events` older than 7 days, expired `verifications` and `sessions`, and `invite_requests` past 90 days (§2.3).

### 2.9 Storage (`db/schema.sql`) — additive

Better Auth's four tables are mapped onto snake_case names; `users` is the existing table, extended. IDs stay `uuid` (Better Auth configured to generate UUIDs), so every existing foreign key to `users(id)` keeps working. The exact column set must match the Better Auth release installed; check it with its schema generator before writing `ensure-schema.ts`.

```sql
-- users: existing table becomes Better Auth's user table
alter table users alter column password_hash drop not null;   -- no longer read; dropped in a later cleanup
alter table users add column if not exists name text;
alter table users add column if not exists email_verified boolean not null default false;
alter table users add column if not exists image text;
alter table users add column if not exists updated_at timestamptz not null default now();
alter table users add column if not exists role text not null default 'user';
alter table users add column if not exists banned boolean not null default false;
alter table users add column if not exists ban_reason text;
alter table users add column if not exists ban_expires timestamptz;
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists limits jsonb not null default '{}'::jsonb;
alter table users add column if not exists register_refused_at timestamptz;      -- banner on Setup / Switches (§2.4)
alter table users add column if not exists register_refused_reason text;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one row per sign-in method: 'google', 'github', or 'credential' (self-hosted password)
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  account_id text not null,
  provider_id text not null,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);

-- emailed codes (hashed by Better Auth), OAuth state
create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

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

create table if not exists invite_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  invite_id uuid references invites (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists invite_requests_pending_email_idx
  on invite_requests (lower(email)) where status = 'pending';

create table if not exists auth_events (
  id bigserial primary key,
  kind text not null check (kind in ('email_sent', 'code_failed', 'invite_requested')),
  email text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists auth_events_email_idx on auth_events (kind, email, created_at);
create index if not exists auth_events_time_idx on auth_events (kind, created_at);
```

**Existing account.** On deploy, the seeded `USER_EMAIL` row keeps its `id` and gets `email_verified = true`. For self-hosted sign-in, a `credential` row in `accounts` holds its password hash. Better Auth is configured with the console's existing scrypt hash and verify functions (`lib/auth.ts`), so today's `password_hash` is copied over as is and `USER_PASSWORD` keeps working.

Invite codes are stored as SHA-256 hashes, like device keys. Old rows are deleted by the daily cleanup cron (§2.8).

### 2.10 Configuration

| Env var | Purpose | Unset means |
| --- | --- | --- |
| `AUTH_SECRET` | Existing; also Better Auth's signing secret | Console does not start (as today) |
| `BETTER_AUTH_URL` | Public URL, for OAuth callbacks and links in emails | Taken from the request |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending codes, invites and notices. Hosted: sent from `hue.tineira.com` itself (e.g. `Hue Switch <codes@hue.tineira.com>`), verified in Resend with SPF and DKIM on that domain | Password sign-in only; no email codes; `SIGNUP_MODE` forced to `closed` |
| `EMAIL_DAILY_CAP` | §2.5 | 90 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Continue with Google | Button hidden |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Continue with GitHub | Button hidden |
| `SIGNUP_MODE` | §2.3 | `closed` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot check on the email and invite-request forms | No bot check |
| `ADMIN_EMAILS` | §2.7 | The seeded `USER_EMAIL` is admin |
| `CRON_SECRET` | §2.8 | Cleanup endpoint returns `503` |
| `LIMIT_SWITCHES`, `LIMIT_BRIDGES`, `LIMIT_KEYS`, `LIMIT_SNAPSHOT_KB` | §2.4 | Defaults above |

`USER_EMAIL` / `USER_PASSWORD` keep seeding the first account. The disposable-domain list comes from the `disposable-email-domains` npm package.

A self-hoster needs only what they need today: `DATABASE_URL`, `AUTH_SECRET`, `USER_EMAIL`, `USER_PASSWORD`. `DATABASE_DRIVER=pg` runs the console on any Postgres instead of Neon's HTTP driver. `EMAIL_DEV_CONSOLE=1` prints emails to the server log in local development.

### 2.11 Services and free tiers (hosted)

| Service | For | Free tier (checked 2026-09-26) |
| --- | --- | --- |
| Vercel Hobby | Hosting, daily cron, one WAF rate-limit rule | 1M function calls and 4 active CPU-hours a month. **Non-commercial, personal use only**: the service must not take money in any form, or it moves to Pro. |
| Neon Free | Postgres | 0.5 GB, 100 compute-hours a month; suspends after 5 min idle (hence the 900 s idle poll, §2.1) |
| Resend Free | Email | 3,000 a month, **100 a day**, 3 domains (hence the 90-a-day cap, §2.5) |
| Google Cloud, GitHub | OAuth clients | Free. Basic email/profile scopes need no Google app review. |
| Cloudflare Turnstile | Bot check | Free, unlimited checks |

The first limit the service will reach is board traffic, not sign-in: at 900 s, one board makes about 2,900 calls a month, so the Vercel free tier holds roughly 300 boards. Past that, or once the database no longer sleeps enough, the plan is Neon and then Vercel paid plans.

### 2.12 Legal pages

`/privacy` is a page in the console (`app/privacy/page.tsx`), linked from `/login` and the footer, and public so Google's consent screen can point at it. It describes what this console stores; its contact is `CONTACT_EMAIL`, or the operator's X profile when unset. `PRIVACY_URL` overrides the `/login` link (a self-hoster with their own policy). `/terms` is still only a link, shown when `TERMS_URL` is set. Writing the text is the operator's job, not this spec's. It should cover the emails stored by invite requests (§2.3) and the data received from Google and GitHub (email, name, avatar).

## 3. Compatibility

- **Boards that have not updated:** nothing changes for a board whose account is within its limits. Both firmwares treat any non-200 from the console as a failed call and retry on their normal schedule; only `401` sets the "key rejected" state (`hue-simple-switch/console.h` `consoleNoteHttp`, `hue-round-switch/console.h`). So `403`, `413` and `429` show up as a failed sync, and NVS recipes keep running. Before deploy, check that the existing account is below every limit (`select count(*) from switches`, `bridges`).
- **Idle poll 900 s:** within the 30–3600 s range both firmwares already clamp to. Boards pick it up from the next `X-Poll-Sec`.
- **Board ahead of the console:** not applicable; no firmware change is needed.
- **Firmware versions that need the old path:** none.
- **The existing account** keeps its data and `id`. On the hosted console it signs in with Google (same email) or an emailed code; the password stays usable only on consoles without email.
- **Existing browser sessions end at deploy.** The `hsw_session` cookie is not read by Better Auth, so everyone signs in once after the deploy. Boards are not affected: device keys do not change.
- **Hosted domain:** stays `hue.tineira.com`, which is also `CONSOLE_URL` in both firmwares. Moving it is out of scope and would be its own cross-repo change.
- **When the old path can be removed:** `users.password_hash` can be dropped once the `credential` rows exist on every console that upgraded. Nothing else is retired.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Confirm the current Better Auth release works with Next.js 16.3 (better-auth 1.7.6 lists `next ^16` as a peer)
- [x] `hue.tineira.com` verified in Resend (all records, 2026-09-27); `RESEND_API_KEY` (sending access, limited to `hue.tineira.com`) set in Vercel Production and deployed; `EMAIL_FROM` set
- [x] Google and GitHub OAuth clients created with callback `https://hue.tineira.com/api/auth/callback/{google,github}`; keys set in Vercel (2026-09-27)
- [x] Google consent screen shows "Hue Switch Console": own Cloud project `hue-switch-console`, branding verified and published, `tineira.com` verified in Search Console (2026-09-27). Public landing page at `/` for the review
- [x] Turnstile widget "Hue Switch Console sign-in" created; site and secret keys set in Vercel (2026-09-27)
- [x] Schema (§2.9) in `db/schema.sql` and `lib/ensure-schema.ts`, checked against Better Auth's generated schema; existing account migrated (email verified, `credential` row)
- [x] Better Auth setup (`lib/auth.ts`, `/api/auth/[...all]`): email OTP, Google, GitHub, account linking, password only without email, rate limiter, hooks (sign-up gate, disposable domains, suspended check, admin role, `last_login_at`); Turnstile and suspension in the console (§2.2 "As built"); `getSessionUser` wraps it
- [x] Email sending (`lib/email.ts`, Resend) with the sign-in code, change-email code, old-address notice and invite templates, in English; `EMAIL_DAILY_CAP`
- [x] `/login`: provider buttons, email → code form, invite cookie, request-an-invite form; password form only without email
- [x] `SIGNUP_MODE`, invites and invite requests (§2.3)
- [x] Per-account limits in `POST /api/device/register` and `POST /api/keys`; `account_suspended`; register body size limit; banner on Setup and Switches for refused registers
- [x] `POLL_IDLE_SEC` 300 → 900 in `lib/config-sync.ts`
- [x] Before deploy: the existing account is below every limit, and the largest stored snapshot is well under 512 KB (2026-09-26: 4 switches, 1 Bridge, 4 active keys, largest snapshot 31 KB)
- [x] `/account`: sign-in methods, change email, sign out everywhere, delete account
- [x] `/admin`: accounts table with Dormant filter, suspend, delete, limits, invites, invite requests
- [x] Cleanup cron (`/api/cron/cleanup`, `vercel.json` cron entry)
- [x] Vercel Firewall rate-limit rule on `/api/device/*` ("Device API rate limit": 60 requests / 60 s per IP, 429) (2026-09-27)
- [x] `docs/device-api.md` updated in the same commit as the register limit and the idle poll (§2.1)
- [x] `docs/definitions.md`: "User account", "No public signup", the auth row, and the poll interval (line on "5 min otherwise") updated
- [x] `README.md`: env vars (§2.10), services (§2.11) and self-hosting without email or OAuth
- [x] `docs/changelog.md` console entry (including "sign in again once" and the 15-minute idle poll)
- [x] Deployed (2026-09-26); `CRON_SECRET` set; `/privacy` page live (§2.12)
- [x] Checked on production by the user: Google and GitHub sign-in link to the existing account (2026-09-27)
- [ ] **TODO** Checked on production by the user: sign-in by code, invite request → approve → sign-up from the invite email, account deletion on a test account
- [ ] **TODO** Revisit the `/login` Turnstile and invite-request changes of 2026-09-27 (explicit render, the invite form mounting only when opened, `/login?request=invite` from the landing page). The user wants them reworked later.

### Round (`hue-round-switch`)

- [ ] No change required. Optional later: show "account limit reached" on the display for `403 limit_reached`.

### Simple (`hue-simple-switch`)

- [ ] No change required.

### Cleanup

- [ ] Drop `users.password_hash` once every upgraded console has its `credential` row

## 5. Open questions

All six are closed (2026-09-26).

1. **CLOSED: Build or buy sign-in.** Better Auth. Goals: a free public service, easy sign-in with no password, simple infrastructure for the operator, simple self-hosting. Better Auth gives email codes, Google and GitHub sign-in, account linking and admin tools inside the console and its Postgres, with no extra service for anyone. Building it ourselves would mean owning the OAuth and account-linking code; a hosted auth service (Clerk, Neon Auth) would tie self-hosters to a vendor. Cost accepted: new session, account and verification tables, and everyone signs in once after the deploy.
2. **CLOSED: Limits.** Keep 25 switches / 5 bridges / 25 keys / 512 KB, each overridable by env and per account. The largest real snapshot is checked before deploy (checklist).
3. **CLOSED: Email provider.** Resend, sending from `hue.tineira.com` itself, not a subdomain or a new domain (§2.10). Capped at 90 a day to stay on the free tier (§2.5).
4. **CLOSED: Waitlist.** `/login` offers "Request an invite". Requests are stored, the admin approves or dismisses them in `/admin`, and approval emails the invite link to the requester (§2.3).
5. **CLOSED: Dormant deletion.** v1 only lists dormant accounts in `/admin`; deletion is manual. No warning emails and no automatic deletion (§2.8).
6. **CLOSED: Hosted domain.** Stays at `hue.tineira.com`. No firmware impact (§3).
