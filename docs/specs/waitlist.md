# Waitlist with a user cap

Console-only spec. Process: `AGENTS.md` → "Cross-repo changes". Builds on `docs/specs/finished/multi-user-accounts.md` (referred to below as "accounts spec").

**Status:** in progress. Approved, implemented and deployed (2026-09-27); waiting for the production checks. All open questions in §5 are decided.

## 1. What and why

The hosted console runs on free tiers (Vercel Hobby, Neon Free, Resend Free; accounts spec §2.11). It must not grow faster than those tiers hold, and the operator wants to see how much interest there is. Today sign-up is invite-only: a visitor requests an invite with an email and a note, and the admin approves or dismisses each request by hand.

Afterwards:

- A visitor **joins the waitlist** with just an email. No note.
- While the console is below its **user cap**, a person who joins gets an invite right away, with no admin step.
- Once the cap is reached, people queue first-come, first-served and get one email saying they are on the list. When the admin raises the cap in `/admin`, the next people in line get invites automatically. Waitlist emails go out at a limited daily rate so they never use up the email budget that sign-in codes need.
- Addresses that **bounce** or **mark the email as spam** are taken off the list automatically (Resend webhook), and an invite that bounces gives its seat to the next person.
- The admin sees the numbers that matter for deciding when to raise the cap: seats used, queue length, joins over time, bounces, and load estimates. An email warns the admin before the console is full.
- The admin can still admit someone ahead of the queue, remove an entry, or switch back to manual approval (for example, during a spam wave).
- The copy is honest: the hosted console lets people in in batches because it runs on free servers, and anyone can run their own.

## 2. Contract change

### 2.1 `docs/device-api.md`: none

No endpoint, payload, NVS, `HUESET`, Improv or installer change. Boards are not affected.

### 2.2 Sign-up modes

`SIGNUP_MODE` (accounts spec §2.3) gets a fourth value, and the hosted console moves to it:

| Value | Who can create an account | Default for |
| --- | --- | --- |
| `closed` | Nobody. Only the seeded `USER_EMAIL` exists. | Self-hosted (no email provider) |
| `invite` | Someone with an invite. Waitlist entries wait for the admin to approve them (today's behavior). | |
| `waitlist` | Someone with an invite. Waitlist entries are admitted automatically while seats are free (§2.3). | **Hosted, from this change** |
| `open` | Anyone who passes the sign-in checks | Hosted, later |

**Stored in the database, not only in env.** The admin must be able to change the cap and flip between `invite` and `waitlist` without a redeploy. A new `console_settings` row holds `signup_mode` and `user_cap`. `SIGNUP_MODE` and `USER_CAP` in env are the defaults used until the admin saves a value. `/admin` can switch only between `invite` and `waitlist`: `closed` and `open` stay env-only, because they change what the product promises. Without an email provider the mode is still forced to `closed`.

The form is the same in `invite` and `waitlist`; only what happens after it differs. It is not shown with `closed` or `open`.

### 2.3 Seats and admission

**Seats used** = accounts (all rows in `users`, admins included) + unused, unrevoked, unexpired invites. Counting outstanding invites means a released batch can never overshoot the cap.

**Admission** (`waitlist` mode only) takes the oldest `pending` entries, one per free seat. For each one it creates an invite tied to that email and emails the link. It runs:

- when someone joins,
- when the admin saves a new cap or switches to `waitlist`,
- when a seat frees up (an account is deleted, an invite expires or bounces),
- in the daily cleanup cron, as a catch-up.

It stops when there are no free seats, no pending entries, or no waitlist email budget left today (§2.6). Whatever is left goes out on the next run.

**Waitlist invites expire after 7 days** (admin-made invites keep 14). An expired invite frees its seat. Its entry is marked `expired`, and that person can join again at the back of the queue.

**Manual admission.** In either mode the admin can **Admit now** on any pending entry. That works even when the console is full, so the cap is a limit on automatic admission, not on the admin. `/admin` shows when seats used is above the cap.

**Deleting an account frees a seat** and triggers admission. Dormant accounts (accounts spec §2.8) are still only listed, never deleted automatically.

### 2.4 Joining the waitlist (`/login`, landing page)

`/login?request=invite` keeps working, and `/login?request=waitlist` is added. The "Request an invite" form becomes **Join the waitlist**:

- Email only, plus the existing Turnstile check, disposable-domain check and limits (3 per IP per hour, 50 per day per instance; accounts spec §2.5).
- **The note field is removed** (the admin was not going to read it).
- The reply is the same for every accepted address: *"Thanks. Watch your inbox: we'll email you there."* That covers an address that gets an invite now, one that is queued, one that is already queued (nothing new is stored), and one that already has an account (nothing is stored or sent). So the form cannot be used to find out who has an account or who is waiting.
- **Exception: a bounced or complained address** gets *"We couldn't deliver email to this address. Check it or use another one."* That says the address is undeliverable, not who owns it. The entry is not queued again.

**Emails:**

| When | Email | Contains |
| --- | --- | --- |
| Joined, seat free | Invite | Invite link (7-day expiry) |
| Joined, console full (`waitlist` mode only; in `invite` mode nothing is sent until the admin admits them) | "You're on the list" | That people are let in in batches because the service runs on free servers; that we'll email when there's room; a link to the self-hosting guide; a **Leave the waitlist** link |
| Admitted later | Invite | Invite link (7-day expiry) and the Leave link is no longer needed |

**Leave the waitlist.** The confirmation email carries a one-time link (`/waitlist/leave?token=…`, token stored hashed). Opening it and confirming marks the entry `left`. People who want out have a way out other than the spam button, which protects the domain's reputation.

**Landing page and `/login` copy.** The landing page's invite mode (design handoff, `docs/specs/finished/design_handoff_landing_page/README.md`) gets a `waitlist` variant:

| | `waitlist` |
| --- | --- |
| Primary label | Join the waitlist |
| Account line | We let people in in batches while the service runs on free servers. Already have an account? |
| Closing title | Join the waitlist, or run your own. |

Wherever the waitlist is offered, the page also links to self-hosting ("It's open source: run your own console"). The exact wording is finalized in the implementation and follows the same tone as the rest of the landing page.

### 2.5 Bounces and complaints (Resend webhook)

New route `POST /api/webhooks/resend`.

- **Verification:** `resend.webhooks.verify()` from the `resend` SDK (already a dependency), using the raw body, the `svix-id`, `svix-timestamp` and `svix-signature` headers, and `RESEND_WEBHOOK_SECRET`. Bad signature → `400`. Secret unset → `503`, and bounce handling is simply off.
- **Events subscribed:** `email.bounced`, `email.complained`, `email.suppressed`. Nothing else, so the endpoint costs as few function calls as possible.
- **What counts:** `email.bounced` only when `data.bounce.type` is `Permanent`; `email.complained` always; `email.suppressed` always (Resend refused to send because the address is on its suppression list). Transient bounces and delivery delays are ignored.
- **Matching:** by recipient address (`data.to`, lowercased). Every email the console sends is tagged with its kind (`code`, `invite`, `waitlist`, `notice`) through Resend tags, which are logged with the event.
- **Actions:**
  - A `pending` waitlist entry for that address → `bounced` or `complained`. It no longer counts as interest.
  - An unused invite for that address → revoked; its seat is freed and admission runs. The entry is marked `bounced` or `complained`.
  - An existing account's address (a sign-in code or notice bounced) → nothing changes on the account. The event is logged so the admin sees it.
  - Every counted event is logged in `auth_events` (`email_bounced`, `email_complained`) for the counts in `/admin`.
- **Idempotent:** handling the same event twice leaves the same state, so Resend's retries are safe. The route returns `200` for events it ignores.

Resend already stops sending to hard-bounced and complained addresses by itself (its suppression list). This webhook is what lets the console know, so queued entries and seats reflect it.

### 2.6 Email budget

The instance cap stays `EMAIL_DAILY_CAP` = 90 (Resend Free is 100 a day; accounts spec §2.5). Within it, **waitlist emails** (invites from admission and "You're on the list" emails) may use at most `WAITLIST_EMAILS_PER_DAY`, default **40**. That leaves at least 50 a day for sign-in codes and notices. A code request never waits behind the waitlist.

When the waitlist budget is used up for the day:

- A person who joins while a seat is free stays `pending`, first in line, and is admitted by the next admission run that has budget (another join, a cap change, or the daily cron). No invite is created until its email can go out, because only a hash of the invite link is stored. The reply to the form is the same.
- A queued person's "You're on the list" email is skipped if it can't be sent that day. It is not a promise the queue depends on, and the entry keeps its place.

Admin alert emails (§2.7) count toward the instance cap, not the waitlist budget.

### 2.7 Admin (`/admin`)

A **Waitlist** section replaces "Invite requests":

- **Mode:** `invite` or `waitlist` (§2.2).
- **Cap:** number input, saved to `console_settings`. Shows seats used / cap, how many are accounts and how many are outstanding invites, and "over cap" when manual admission went past it.
- **Queue:** pending entries, oldest first, with joined date. Per entry: **Admit now**, **Remove** (status `dismissed`, no email).
- **Interest:** pending now; joined in the last 7 and 30 days; total joined since this change (`joins_total`); admitted, left, expired and removed in the last 90 days (entries other than pending are kept 90 days).
- **Email health:** emails sent today / `EMAIL_DAILY_CAP`; waitlist emails today / `WAITLIST_EMAILS_PER_DAY`; bounces and complaints in the last 30 days, per email kind. A sudden rise is an early sign of bot sign-ups.
- **Load**, to decide when the cap can go up: registered switches, and the estimated monthly device calls against the Vercel free tier (switches × about 2,900 a month at the 900 s idle poll, against 1,000,000; accounts spec §2.11); database size (`pg_database_size`) against Neon's 0.5 GB.

**Alerts.** The admin (`ADMIN_EMAILS`) is emailed when seats used first reaches **80%** of the cap and when it reaches **100%**. At most one alert per threshold until the cap changes, checked on admission and in the daily cron.

### 2.8 Storage (`db/schema.sql`, `lib/ensure-schema.ts`), additive

The existing `invite_requests` table becomes the waitlist, so pending requests at deploy keep their place (ordered by `created_at`). The UI calls it the waitlist; the table name stays to avoid churn.

```sql
-- settings the admin changes without a redeploy (§2.2); one row
create table if not exists console_settings (
  id boolean primary key default true check (id),
  signup_mode text check (signup_mode in ('invite', 'waitlist')),   -- null: use SIGNUP_MODE
  user_cap integer check (user_cap >= 0),                           -- null: use USER_CAP
  cap_alert_sent integer,                                           -- last alert threshold sent (80 or 100), reset when the cap changes
  joins_total bigint not null default 0,                            -- "Joined, total" in /admin, counted from this change
  updated_at timestamptz not null default now()
);

alter table invite_requests drop constraint if exists invite_requests_status_check;
alter table invite_requests add constraint invite_requests_status_check
  check (status in ('pending', 'approved', 'dismissed', 'expired', 'left', 'bounced', 'complained'));
alter table invite_requests add column if not exists confirmation_sent_at timestamptz;
alter table invite_requests add column if not exists leave_token_hash text;
alter table invite_requests drop column if exists note;             -- §2.4
create index if not exists invite_requests_email_idx on invite_requests (lower(email), status);

alter table auth_events drop constraint if exists auth_events_kind_check;
alter table auth_events add constraint auth_events_kind_check
  check (kind in ('email_sent', 'code_sent', 'code_failed', 'invite_requested',
                  'waitlist_email_sent', 'email_bounced', 'email_complained'));
alter table auth_events add column if not exists detail text;       -- email kind (Resend tag) of a bounce or complaint
```

`approved` keeps its meaning (invite issued). Seats are computed from `users` and `invites`, not stored.

**Retention changes** in the daily cron (accounts spec §2.8): today it deletes pending and dismissed requests after 90 days. From this change, **pending entries are kept** (deleting them would lose people's place). Entries in any other status are deleted 90 days after `decided_at`. `bounced` and `complained` entries are kept for those 90 days so re-joining the same address gets the "couldn't deliver" reply. `auth_events` keep their 7-day retention, except `email_bounced` and `email_complained`, which are kept 30 days for the counts in §2.7.

### 2.9 Configuration

| Env var | Purpose | Unset means |
| --- | --- | --- |
| `SIGNUP_MODE` | Adds `waitlist` (§2.2); default until the admin saves a mode | `closed` |
| `USER_CAP` | Default cap until the admin saves one | No cap: `waitlist` admits everyone (still subject to the email budget) |
| `WAITLIST_EMAILS_PER_DAY` | §2.6 | 40 |
| `RESEND_WEBHOOK_SECRET` | Verifies Resend webhook calls (§2.5) | Webhook returns `503`; no bounce handling |

**Setup is done by Claude, not by hand.** Claude creates the Resend webhook (endpoint `https://hue.tineira.com/api/webhooks/resend`, the three events in §2.5) through the Resend connector, then sets its signing secret as `RESEND_WEBHOOK_SECRET` (sensitive, Production) together with `SIGNUP_MODE=waitlist` and `USER_CAP` directly in Vercel through the Vercel connector, and redeploys. The secret is never pasted into chat or committed. The user does not need to open either dashboard.

### 2.10 Privacy page

`/privacy` (accounts spec §2.12) is updated: a waitlist email is kept until the person is admitted, leaves, or is removed, then for 90 days; bounce and complaint notices from Resend are used to take undeliverable addresses off the list; the confirmation email has a leave link. The note field is no longer mentioned.

## 3. Compatibility

- **Boards:** not affected.
- **Pending invite requests at deploy:** become waitlist entries in their original order. Their notes are dropped with the column. Check the count and read the notes before deploy (checklist).
- **Invites already issued** keep their 14-day expiry and count as seats until used or expired.
- **Existing accounts** count as seats. If there are already more accounts than the chosen cap, nobody is admitted automatically until accounts are deleted or the cap is raised. Nothing is taken away from anyone.
- **Self-hosted consoles:** unchanged. Without an email provider the mode is `closed`, and `waitlist` needs email to work.
- **`/login?request=invite` links** keep working.
- **Old path to remove:** none. `invite` mode stays as the manual option.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Before deploy: count pending invite requests and read their notes (the column is dropped); count accounts, to choose the starting cap (2026-09-27: no pending requests; one approved test request whose note is dropped; 1 account, no open invites, 4 switches)
- [x] Schema (§2.8) in `db/schema.sql` and `lib/ensure-schema.ts`
- [x] `console_settings` read with env fallback; `waitlist` mode in the sign-up gate
- [x] Seats and admission (§2.3), called on join, cap change, seat freed and in the daily cron; 7-day waitlist invites; expired invites free their seat
- [x] `/login` and landing page: "Join the waitlist", note removed, uniform reply, "couldn't deliver" reply, self-hosting link (§2.4)
- [x] Emails: "You're on the list" template with leave link; waitlist invite template (7 days); Resend tags on every email; `WAITLIST_EMAILS_PER_DAY` (§2.6)
- [x] `/waitlist/leave` page
- [x] `POST /api/webhooks/resend` with signature check and the actions in §2.5
- [x] `/admin` Waitlist section: mode, cap, queue, interest, email health, load (§2.7); 80% and 100% alert emails
- [x] Cleanup cron retention changes (§2.8)
- [x] `/privacy` update (§2.10)
- [x] `README.md` env vars (§2.9); `docs/definitions.md` if it describes sign-up; `docs/changelog.md` console entry
- [x] By Claude: Resend webhook created through the connector; `RESEND_WEBHOOK_SECRET`, `SIGNUP_MODE=waitlist` and `USER_CAP=50` set in Vercel through the connector; deployed (2026-09-27, `fa5ef59`). Webhook answers unsigned calls with 400; schema migrated
- [ ] Checked on production by the user: join with a seat free → invite arrives; with the cap full → "You're on the list" arrives; raise the cap → invite arrives; leave link works
- [x] Checked on production: a bounce test address (Resend's `bounced@resend.dev`) is marked `bounced`, and re-joining with it shows the "couldn't deliver" reply. Checked by the user on 2026-09-29: with a seat free the join sent an invite, the bounce revoked it (Invites shows "revoked"; the bounce is counted in the "Bounces and complaints" tile, since `/admin` lists only people still waiting), and re-joining showed the reply.

### Round (`hue-round-switch`)

- [x] No change required.

### Simple (`hue-simple-switch`)

- [x] No change required.

## 5. Open questions

1. **CLOSED: Starting cap.** 50 seats (user, 2026-09-27), set as `USER_CAP`. At about 4 switches per account that is 200 boards, under the roughly 300 the Vercel free tier holds at the 900 s idle poll (accounts spec §2.11). Raise it in `/admin`.
2. **CLOSED: Waitlist email budget.** **40 a day** out of 90 (user, 2026-09-27), the `WAITLIST_EMAILS_PER_DAY` default. Sign-in codes always keep at least 50. A cap raise of 100 then takes about 3 days to go out, which is acceptable for a batch release.
3. **CLOSED: Waitlist invite expiry.** **7 days** (user, 2026-09-27), `WAITLIST_INVITE_DAYS`, so seats that nobody uses come back quickly. Admin-made invites keep 14.
4. **CLOSED: Should `/admin` be able to switch to `open`?** **No** (user, 2026-09-27); the `console_settings.signup_mode` check allows only `invite` and `waitlist`. Keep `open` and `closed` env-only, because they change what the product promises publicly; the admin page covers the day-to-day switch between `invite` and `waitlist`.
