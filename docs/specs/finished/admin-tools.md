# Admin tools

Console-only spec. Process: `AGENTS.md` → "Cross-repo changes". Builds on `docs/specs/finished/multi-user-accounts.md` ("accounts spec") and `docs/specs/finished/waitlist.md`.

**Status:** done (2026-09-27). Deployed and checked on production; `users.role` dropped.

> **Later change (2026-09-29):** an upload no longer becomes current on its own. It waits in `/admin` until an admin makes it current, and `POST /api/firmware/<product>/current` answers `410`. Current behavior: `README.md`, "Firmware release pipeline".

## 1. What and why

`/admin` today can suspend, delete and set limits on accounts, and run invites and the waitlist. It stops working well as the console grows, and some jobs still need a terminal. Afterwards the admin can:

- Find any account by email and page through all of them, not only the newest 1,000.
- See every stored firmware release per product and make one current (roll back or forward) from `/admin`, without the CI token and `curl`.
- See who did what: every admin action is recorded and the last ones are listed.
- Suspend with a reason and, optionally, an end date; the suspension lifts on its own.
- See every invite, filtered by state, not only the 30 newest.
- See why a switch's register was refused, and read in the limits form that an empty field means the default.

And the rules that decide who is an admin live in one place.

## 2. Contract change

### 2.1 `docs/device-api.md`: none

No endpoint, payload, NVS, `HUESET`, Improv or installer change. Boards are not affected. `POST /api/firmware/<product>` and `POST /api/firmware/<product>/current` keep working with the CI token.

### 2.2 Who is an admin

`ADMIN_EMAILS` (or `USER_EMAIL` when it is unset) stays the only source. `requireAdmin()` already reads it.

- Stop writing `users.role` at sign-in (`lib/better-auth.ts` session hook). The column stays, unused, until a later cleanup drops it.
- The guards move into `lib/admin.ts`: `setBanned` and `deleteAccountById` refuse an admin email, whoever calls them. `/account` hides "Delete account" for an admin and says to remove the address from `ADMIN_EMAILS` first. On `/admin` an admin account's **Manage** row (2026-09-30) offers limits only, with the same note in place of Suspend and Delete.

No promote-to-admin UI: changing who administers a hosted console is a deploy decision.

### 2.3 Accounts: search and paging

- `/admin?q=<text>&page=<n>&sort=<key>`. `q` matches a substring of the email, case-insensitive. 50 rows a page. Sorting happens in SQL on the existing sort keys, not in Node.
- `listAccounts` replaces its three correlated subqueries with grouped joins, and returns the total for the pager.
- New index `switches (user_id, last_seen_at)` for the "last board seen" sort.
- The row shows the last register refusal (`register_refused_at`, `register_refused_reason`) when it is newer than the account's last board check-in (`switches.last_seen_at`).

### 2.4 Firmware

A "Firmware" section, one table per product:

| Column | Source |
| --- | --- |
| Version | `firmware_releases.version` |
| Uploaded | `firmware_releases.created_at` |
| Bins stored | parts present (the 5 newest and the current keep them) |
| Current | `firmware_current` |

Each row with bins has "Make current", which calls `setCurrentRelease` behind `requireAdmin()` and records an audit event. Rows without bins (pruned, or imported from the old changelog) show "notes only" and cannot be made current.

Uploads still become current at once (§5, decision 1).

### 2.5 Audit log

New table:

```sql
create table if not exists admin_events (
  id bigserial primary key,
  admin_email text not null,
  action text not null,
  target_user_id uuid references users(id) on delete set null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_events_created on admin_events (created_at desc);
```

`target` keeps the email or version as text, so an event still reads well after the account is deleted. Every admin action writes one row: suspend, unsuspend, delete, limits, invite create, email, revoke, waitlist admit, remove, settings change, firmware current. Since 2026-09-30 two events nobody clicked go in the same table, with a reserved actor in `admin_email`: `waitlist_auto_admit` (`system:console`, an automatic waitlist admission) and `firmware_upload` (`system:firmware-ci`, a new release from firmware CI). `/admin` shows these actors as "The console" and "Firmware CI". `/admin` lists the newest 50. The daily cron deletes events older than 1 year.

### 2.6 Suspension reason and end date

- The suspend form gets a reason (optional, up to 200 characters; stored in `users.ban_reason`, today hardcoded to "Suspended by admin") and an optional end date (`users.ban_expires`).
- A suspension counts only while `ban_expires` is null or in the future: in `authenticateDevice`, the session hook and the account list. The daily cron clears `banned` once `ban_expires` has passed, so the stored flag catches up.
- The reason is shown to the admin only. The person sees the same "This account is suspended." message as today.

### 2.7 Invites

The invite list pages (50 a page) with a filter: open, used, revoked, expired. Today it shows the 30 newest out of up to 200 read, with no hint that more exist.

### 2.8 Limits form

Each field's placeholder already shows the default. The form adds one line: "Empty means the console default." Saving the form with every field empty stores `{}`, as today.

### 2.9 Storage (`db/schema.sql`, `lib/ensure-schema.ts`), additive

The `admin_events` table and its index (§2.5) and the `switches (user_id, last_seen_at)` index (§2.3). Nothing is dropped.

## 3. Compatibility

- Console behavior with a board that has not updated: unchanged. No device path changes.
- Board behavior with a console that has not deployed: not applicable.
- Firmware versions that need the old path: none.
- When the old path can be removed: `users.role` can be dropped once nothing reads it (a later cleanup, with the user's OK).

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Admin guards moved into `lib/admin.ts`; `users.role` no longer written; `/account` delete hidden for admins (§2.2)
- [x] Accounts search, paging, SQL sort, grouped joins, index, refusal column (§2.3)
- [x] Firmware section with "Make current" (§2.4)
- [x] `admin_events` table, a row per action, newest 50 listed, 1-year cron cleanup (§2.5)
- [x] Suspension reason and end date; expiry honored in device auth, sessions and the list; cron clears expired (§2.6)
- [x] Invite list paging and filter (§2.7)
- [x] Limits form hint (§2.8)
- [x] `db/schema.sql` and `lib/ensure-schema.ts` updated in the same commit (§2.9)
- [x] `docs/device-api.md`: no change
- [x] Deployed; checked on production

### Round (`hue-round-switch`)

Nothing to do.

### Simple (`hue-simple-switch`)

Nothing to do.

### Cleanup

- [x] Drop `users.role` (user OK, once nothing reads it)

## 5. Decisions (2026-09-27)

1. **Upload staging:** no. A CI upload still becomes current at once; `/admin` adds "Make current" for rollback and forward. Revisit when more than one person can push to a firmware repo.
2. **Audit retention:** 1 year. The daily cron deletes older `admin_events` rows.
3. **Suspension reason:** admin only. The person sees "This account is suspended." as today.
4. **Page size:** 50 accounts and 50 invites a page.
