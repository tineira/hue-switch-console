# Admin in tabs

Console-only. No device API, payload or firmware change.

**Status:** done 2026-09-30 (#59).

## 1. What and why

`/admin` was one long page doing five jobs. The rarest action (sign-up mode and seat cap) came first, and the "Waitlist" card mixed waitlist numbers with email budget and hosting load at equal weight. Accounts, the main thing an admin manages, came fourth, after Invites and Firmware. Things that needed the admin (a release waiting, people in line with full seats, a failed update) were spread across sections.

Afterwards `/admin` opens on an **Overview** of what needs the admin, and each job has its own tab.

## 2. Structure

Five tabs, each its own route, sharing a header with the tab row. Tab labels carry counts when there is something to see ("Accounts · 3", "Firmware · 1 waiting"). Each tab loads only its own data.

| Route | Tab | Content |
| --- | --- | --- |
| `/admin` | Overview | **Needs you**: only what needs action, each linking to where it's fixed. Covers releases waiting to go live, people in line (warned when seats are full), a cap at 80% or more, switches with a failed update in the last 7 days, bounces or complaints in the last 30 days, and accounts whose last register was refused. When there's nothing, the section is not shown (changed 2026-09-30 at the user's request: an empty section was noise). Then four numbers: **Accounts** (seats used / cap, people waiting), **Switches** (total, quiet 24 h), **Emails today** (sent / daily cap, bounces 30 days), **Free tier** (the higher of database and function-call use, with both in the note). Then the newest 5 activity rows and a link to Activity. |
| `/admin/accounts` | Accounts | **In line** (the waitlist queue, only when someone waits), then the accounts table with search, sort, Dormant and the Manage row, then **Invites**. Invites defaults to **open** instead of all; Create invite folds into a disclosure. |
| `/admin/firmware` | Firmware | Waiting releases first (a banner), then per product the fleet table and the release list, as before. |
| `/admin/settings` | Settings | Sign-up mode and seat cap. Account limit defaults (read-only, from the environment). Email budgets (daily cap, waitlist emails per day). The waitlist history numbers (joined 7/30 days, total, last 90 days). |
| `/admin/activity` | Activity | The newest 50 events, filterable by **everyone / admins / console / firmware CI** (`?by=`). |

Bounces and refused boards stay true for days, so their notices have **Dismiss** (added 2026-09-30 at the user's request). It stores the time in `console_settings.notices_seen` (`{"bounces": …, "refused": …}`), and the notice counts only what came after it.

Old links keep working. `/admin` with any accounts or invites parameter (`q`, `sort`, `dir`, `filter`, `page`, `manage`, `invites`, `ipage`) redirects to `/admin/accounts` with the same query. The **Admin** menu item keeps pointing at `/admin`.

Server actions refresh every admin route (`revalidateAdmin()`), since one action can change several tabs' counts.

## 3. Compatibility

- Device API: unchanged.
- The cap alert email says "Raise the cap in /admin"; it now reads "/admin/settings".

## 4. Checklist

- [x] Shared admin parts moved out of the page (`app/admin/parts.tsx`)
- [x] Overview with Needs you, four numbers, recent activity
- [x] Accounts, Firmware, Settings, Activity routes
- [x] Old `/admin?…` links redirect to `/admin/accounts`
- [x] Actions refresh every admin route
- [x] Changelog entry; `admin-tools.md` points here
- [x] Deployed; every tab checked on production, at desktop and phone width (2026-09-30)
