# Plan: fixes and gaps from the 2026-09-30 console review

A plan for work in the console only. It comes from a walk through production (`hue.tineira.com`) on 2026-09-30, signed in as the admin: every page plus the logged-out home page, with the code read alongside. No firmware repo changes. The device contract (`docs/device-api.md`) gains two human endpoints (§C) and nothing a board calls.

**Status:** approved 2026-09-30, with Claude's recommendation on every question in §F. In progress.

## How it ships

Four PRs, each from its own worktree off `origin/main` (AGENTS.md, "Parallel sessions"). They are independent, so they can merge in any order. Each one:

- adds a user-facing entry to `docs/changelog.md` under the day it goes live;
- passes `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build`;
- is checked on production after the deploy, in the user's Chrome while signed in (Claude in Chrome, as in the review). Local Playwright is not used for signed-in pages (AGENTS.md).

| PR | Contents | Size |
| --- | --- | --- |
| 1. Quick fixes | A1–A4, D1–D4 | small |
| 2. Admin | B1–B6 | medium |
| 3. Remove switches and Bridges | C | medium |
| 4. Round page-name preview | A5 | small, after a firmware read |

---

## A. Bugs

### A1. Changelog prints raw markdown

**Seen:** on `/changelog` every `**bold**` and `` `code` `` shows its asterisks and backticks (about 150 `**` on the page). It is public, and it is the most visible defect.

**Cause:** [app/changelog-item.tsx](../../app/changelog-item.tsx) renders `item.text` as plain text. How-to already has a small renderer (`Rich` in [app/how-to/how-to-guide.tsx:23](../../app/how-to/how-to-guide.tsx)), but it handles `**` only.

**Fix:**
1. Move `Rich` into a shared `app/rich-text.tsx` and teach it `` `code` `` too (a `<code>` in the mono font). It stays a regex split over plain strings: no HTML, no `dangerouslySetInnerHTML`, no new dependency.
2. Use it in `ChangelogItemText` for normal and **Important** items. How-to imports it from the new file.
3. Firmware notes go through the same component, so they are fixed as well.
4. A unit test: bold, code, both in one item, and an unmatched `**` left as text.

**Check:** `/changelog` on production has no literal `**` (`document.body.innerText.includes("**") === false`).

### A2. Admin: "Joined, last 7 days" (5) is larger than "Joined, total" (4)

**Cause:** "last 7 days" counts rows in `invite_requests`. The total is the `console_settings.joins_total` counter, which `countJoin()` increments in `joinWaitlist`. That is the only insert path, so the counter was most likely added after one entry already existed. The counter is there because entries other than pending are deleted after 90 days, so the table alone cannot give an all-time total.

**Fix:**
1. A one-time backfill in the schema bootstrap (`db/schema.sql` → `lib/generated/schema.ts`, via the existing generator): `update console_settings set joins_total = greatest(joins_total, (select count(*) from invite_requests))`. It is idempotent and safe to run on every boot.
2. The page shows `max(joinsTotal, joined30)`, so the two numbers can never contradict each other again, whatever the cause.

**Check:** the total on `/admin` is at least the 7-day and 30-day counts.

### A3. How-to and Switches say "within an hour"

**Seen:** How-to says a saved change reaches the switch "within an hour" ([how-to-guide.tsx:176](../../app/how-to/how-to-guide.tsx), [lib/how-to.ts:184](../../lib/how-to.ts)). The idle poll is 900 s. It is about 30 s while Switches is open, or after a save within 15 min (`docs/device-api.md` § `X-Poll-Sec`).

**Fix:** reword both to "within about 15 minutes, or about 30 seconds while Switches is open". Check [workspace.tsx:648](../../app/switches/workspace.tsx) ("tries again within an hour", the OTA retry) against the firmware's actual OTA retry interval in `docs/device-api.md` § `ota`, and fix it only if it is wrong. Grep for any other "hour" timing claims in `lib/how-to.ts`.

### A4. The theme button shows the wrong theme on every page load

**Seen:** the header says "Theme · Slate Light" over a dark Kanagawa page until hydration.

**Cause:** [app/theme-picker.tsx:58](../../app/theme-picker.tsx) starts from `DEFAULT_THEME` on the server and reads `localStorage` in an effect.

**Fix:** until mounted, render the button with the label hidden (`invisible`, width kept) so nothing flashes, then show the real name. The page colours already come from the inline boot script and do not change.

### A5. The Round preview cuts off page names within the limit

**Seen:** "Veladores" (9 of the allowed 12 characters) previews as "Velador…".

**Cause:** `.round-dial-name` in [app/switches/round-dial.tsx](../../app/switches/round-dial.tsx) uses CSS ellipsis at a fixed size. The limit is `PAGE_NAME_MAX = 12` ([lib/round-themes.ts:306](../../lib/round-themes.ts)), which `lib/pages.ts` validates.

**Fix:** first, read how `hue-round-switch` draws the name (font, size, whether it shrinks, wraps or cuts off). This is read-only in its checkout, with no edits. Then make the preview do the same thing, most likely by stepping the font down so 12 characters fit, as the board does. Only if the board itself cuts names off: raise it as a Round firmware issue. Do not lower `PAGE_NAME_MAX`, which would reject names already saved (§F4).

---

## B. Admin

Everything stays "counts only, never recipes or topology" (the page's own promise and `docs/specs/finished/admin-tools.md`).

### B1. Firmware across the fleet

**Why:** AGENTS.md says an old path is retired "only once no registered switch reports an older `firmware` (check `switches.firmware`)". Today that needs SQL.

**What:** a "Fleet" block at the top of the Firmware section, one table per product: version, number of switches, how many of those were not seen for 24 h, and how many have an `ota_error` in the last 7 days. The current version is marked and older ones are highlighted. It also counts switches with no reported firmware.

**How:** one grouped query in `lib/admin.ts` over `switches` (`product`, `firmware`, `last_seen_at`, OTA error fields). No per-account breakdown.

### B2. Log what the console does on its own

**Seen:** stats say 4 were admitted, but the activity log shows none, because waitlist auto-admits are not recorded. Firmware uploads from CI are not recorded either.

**What:** two new `AdminAction`s written with `admin_email = 'system'` (the column is `not null` and has no check constraint, so no schema change):

- `waitlist_auto_admit` (target: email), from `admitFromWaitlist` / `admitQuietly` in `lib/waitlist.ts`;
- `firmware_upload` (target: `round 0.6.5`, details: `{ waiting: true }`), from `POST /api/firmware/<product>`.

The log shows `system` as "The console" ("The console admitted …", "Firmware CI uploaded simple 0.7.2, waiting"). Update `docs/specs/finished/admin-tools.md` §2.5 to list them.

### B3. Shorter firmware lists

**Seen:** Round has 34 rows and Simple 29, most of them "notes only".

**What:** show every release that has bins, plus a waiting one. Put the notes-only ones behind a `<details>` "Older releases (notes only, N)" (no JS). Drop the `max-h-72` scroller once the list is short.

### B4. Readable limits, with usage

**Seen:** the Manage form labels are raw keys (`switches`, `bridges`, `keys`), and it does not say what the account uses now.

**What:** labels "Switches", "Bridges", "API keys", "Snapshot KB", each with "uses N" next to it. `listAccounts` already returns switches and Bridges; add active keys (`device_api_keys` not revoked) to the same grouped query.

### B5. Invite actions

**Seen:** a bounced invite has no action. An open invite without an email cannot be re-shown, because only a hash of the link is stored.

**What:**
- Bounced: show "Revoke" (it is useless anyway) and a hint to create a new one for a corrected address.
- Open, any email: "New link". Like `emailInviteAction`, it creates a replacement, revokes the old one and shows the new link once in the same inline box as Create invite. Both are logged (`invite_create` + `invite_revoke`).

### B6. Section links

A short row of links under the title: Waitlist · Invites · Firmware · Accounts · Activity, with `id`s on each section. It is plain anchors and costs nothing on a phone.

---

## C. Remove switches and Bridges

**Why:** no route or button deletes a switch or a Bridge. A given-away board, or a Bridge from an old home, stays listed forever and counts toward the account's limits (25 switches, 5 Bridges). Today only deleting the whole account removes them.

### C1. Remove a switch

- **API:** `DELETE /api/switches/{mac}` (session, owner only, `requireUser`). In one transaction:
  1. revoke the switch's `api_key_id`, but only if no other switch uses that key;
  2. delete the switch row (recipes, pages and Simple channels cascade).

  It returns `{ removed: true, key_revoked: boolean }`, or `404 not_found`.
- **Why the key is revoked:** otherwise the board's next check-in re-registers it and it comes back. With the key revoked the board gets `401`, the existing documented behaviour: its saved recipes keep working on the LAN, and the Simple LED goes solid. To bring it back, the user runs Setup → Link to console, which issues a new key and registers it fresh.
- **Shared key** (a developer key on several boards): the key is not revoked. The confirm text says the board will reappear at its next check-in unless its key is revoked on API keys or the board is erased.
- **UI:** in the switch's info panel (ⓘ): "Remove from console". It is a two-step inline confirm with no browser `confirm()`: the button turns into "Remove ESP32C6-1? [Remove] [Cancel]" with one line on the consequences. If the board is at hand, a line points to Setup → Erase settings first. With unsaved edits on that switch, removing asks the same way leaving the page does. Afterwards the page goes to the next switch, or to the Bridge's empty state.
- **Docs:** `docs/device-api.md` gets a row in "Human APIs" in the same commit. How-to "Retire a lost or given-away board" ([lib/how-to.ts:215](../../lib/how-to.ts)) replaces "revoke the board's key" with "On Switches, open the switch's ⓘ and click Remove from console". The Privacy page needs no change.

### C2. Remove a Bridge

- **API:** `DELETE /api/bridges/{bridgeid}`. It is allowed only when no switch of this account points at it; otherwise it returns `409 bridge_has_switches`. That keeps it simple: any switch still on the Bridge would re-create it at its next register anyway.
- **UI:** on the Bridge block that already says "No switches on this Bridge yet." ([workspace.tsx:787](../../app/switches/workspace.tsx)), add "Remove this Bridge" with the same inline confirm. `/lights` drops it once it is gone.
- **Docs:** a `docs/device-api.md` "Human APIs" row, in the same commit.

### C3. Contract

Only the two human endpoints are added. Nothing a board sends or receives changes, and a removed board sees a `401` that is already documented. So this is not a cross-repo change and needs no firmware work.

**Check (production):** remove a test switch, or a spare board the user picks, and watch it disappear from Switches, Lights, API keys and the account usage count. The user confirms on the board that the LED/screen shows the auth error. Re-linking it on Setup brings it back.

---

## D. Smaller gaps

### D1. Online switches get a status too

The tabs mark only offline switches ("offline 10 h"), so an online one looks unfinished. Add a small green dot for "seen in the last 3 h" (the same 3 h rule that already decides offline) and keep the existing warning styles. Put `aria-label="online"` on the dot.

### D2. API keys: one consistent line per key

Keys made before `usbKeyName` read `USB 2026-09-23 00:37`, newer ones `Simple 58:e6:… · date`. The board name and MAC already sit above each key. For keys bound to a board, show only `prefix… · created date` and drop the stored name. Keys not bound to a board keep their name, because it is the only label they have. Stored names are not rewritten.

### D3. Round: say which lights the ring dims

With Tap and Double tap on different lights, "Dims those lights" ([round-pages-editor.tsx:250](../../app/switches/round-pages-editor.tsx)) does not say which. Use the names `computeDim` already resolves: "Dims Velador Tomás 1.A", or "Dims 3 lights (Tap's)" when it is more than two. Confirm the rule in `computeDim` before wording it.

### D4. Privacy and Credits

- Privacy: add an email contact for data requests next to the X handle (§F3), and bump "Last updated". **Done in PR 1:** the Cloudflare rule forwards `privacy@tineira.com` like `conduct@`. The hosted Privacy page defaults to that address (`CONTACT_EMAIL` still overrides it); setting it on Vercel failed because the Vercel connector refused the request body.
- Credits → Thanks: add **Resend** (email) and **Cloudflare** (DNS and Turnstile), which Privacy already lists as processors.

---

## E. Not verified in the review

- **Phone layout** of admin, Switches and Lights. The review window could not resize, so it was not checked. This goes in PR 2's production check: Chrome at 390 px wide, no horizontal page scroll, and the admin Accounts table scrolling inside its own box.
- **Setup over USB**: it needs the user and a board. None of these changes touch Setup except the How-to wording.

## F. Decisions (2026-09-30: the user took each recommendation)

1. **Removing a switch revokes its key** (C1). *Recommended: yes*, unless another switch shares the key. The alternative, a "removed MACs" list that register refuses, needs a new error code and makes re-adding a board harder.
2. **A Bridge can only be removed once it has no switches** (C2). *Recommended: yes.* Removing its switches as well in one step is possible, but it is easy to do by accident and is rarely needed.
3. **Privacy contact address** (D4). *Recommended:* a forwarding address such as `privacy@tineira.com` through Cloudflare Email Routing. Claude sets it up in PR 1 through the Cloudflare full-API connector. It is connected; checked 2026-09-30: Email Routing is on for `tineira.com` and already forwards `conduct@tineira.com`. The new rule forwards to the same destination as `conduct@`.
4. **Round page names** (A5). *Recommended:* the preview copies the board's rendering, and `PAGE_NAME_MAX` stays 12. Revisit only if the board itself cannot fit 12 characters.
5. **System events in the admin log** (B2). *Recommended:* show them mixed in with admin actions, marked "The console" / "Firmware CI", rather than in a separate list.
