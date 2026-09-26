# Config sync: status and poll cadence

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** approved

## 1. What and why

Today the console knows the latest config revision (`switches.rev`) and when a
switch last polled (`last_seen_at`), but not which revision the switch is
running. A configured switch polls about once an hour, so a saved change can
take up to an hour to land, and nothing tells the person whether it has.

Afterwards:

- Each switch shows a **config status** in the console:

  | Status | Meaning |
  | --- | --- |
  | **Up to date** | The switch reported the current `rev` from NVS. |
  | **Pending** | A newer `rev` exists; the switch has not fetched it yet. Shows when it was saved and when the switch is next expected. |
  | **Not applied** | The switch was served the current `rev` and, on its next poll, still reported an older one (parse or NVS write failure). |
  | **Ahead of console** | The switch reports a higher `rev` than the console and the console has no config to send it (§4.4). |
  | **Unknown** | Firmware that does not report its revision. |

- Changes land within about **30 seconds** while the person is working on a
  switch in the console, and within about **5 minutes** otherwise.
- The console, not the firmware, decides how often each switch polls, so the
  cadence can be tuned later without reflashing.

Constraint: the switches (especially the C6) have no RAM for a connection held
open all the time (WebSocket, MQTT, long-poll), and the HTTPS console page
cannot push to a plain-HTTP device on the LAN. So this stays a poll: cheaper
per request, and paced by the console.

## 2. Contract change

All changes are **additive**.

### 2.1 `GET /api/device/config` request: optional `rev`

```
GET /api/device/config?mac=aabbccddeeff&rev=11 HTTP/1.1
```

- `rev`: the recipe revision stored in the switch's NVS, as a non-negative
  decimal integer, read at request time from the value the switch compares the
  response against (`gRecipeRev`). `0` = nothing applied (fresh flash, NVS
  cleared).
- Missing, empty or malformed `rev` is ignored: no `400`, the full config is
  returned as today, and nothing about the applied revision is recorded.

### 2.2 `GET /api/device/config` response: `204` when unchanged

If the request carries a valid `rev` equal to the revision the console would
serve, the response is:

```
HTTP/1.1 204 No Content
X-Poll-Sec: 300
```

No body. The switch keeps NVS and does not parse anything.

The comparison uses the revision **after** any bump the request itself causes
(Round `persistPageGroupAndDim`, the auto-bump in §4.4).

Without `rev`, or with a different `rev`, the response is `200` with the full
config, as today.

### 2.3 Poll interval from the console

Every `200` and `204` response carries the header `X-Poll-Sec: <seconds>`, and
every `200` body also carries `"pollSec": <seconds>`. The header is the one the
firmware reads, so both response kinds are handled the same way; the body field
is for logs and debugging.

Firmware rules:

- Use `X-Poll-Sec` as the delay until the next poll, clamped to **30–3600 s**.
- Missing or unparseable (older console): keep today's constants
  (`kPollEmptyMs` 1 min with no recipes, `kPollArmedMs` 1 h with recipes).
- `401`: wait the maximum (3600 s), as today's unauthorized case should not
  hammer the console.
- Other errors and network failures: keep today's retry behavior.
- Boot and `gNeedConsoleSync` still poll immediately.

What the console sends (§4.3) is not part of the contract; it can change
without a firmware release.

### 2.4 Confirmation poll

After a switch replaces its NVS with a new `rev`, it polls once more right away,
reporting the new `rev`, instead of waiting `X-Poll-Sec`. The answer is `204`.
This shows **Up to date** within seconds of the switch picking up a change, and
costs one request per change. Not after "keep NVS" or a parse failure.

### 2.5 `docs/device-api.md` edits

- `GET /api/device/config`: document `rev` (§2.1), `204` (§2.2), `X-Poll-Sec`
  and `pollSec` (§2.3).
- "Poll cadence": replace the fixed 1 min / 1 h text with §2.3 and §2.4, keeping
  the old constants as the fallback.
- Human APIs table: `GET /api/switches` and `GET /api/switches/{mac}` gain
  `applied_rev` (integer or `null`), `config_status`
  (`current` | `pending` | `not_applied` | `ahead` | `unknown`) and
  `next_poll_at` (timestamp or `null`).

No NVS keys written over USB change. The installer does not change.

## 3. Compatibility

- **Console with a board that has not updated:** no `rev` in the query, so it
  always gets `200` and the full config, exactly as today. It ignores `pollSec`
  (unknown JSON field) and the header. Its status is **Unknown**.
- **Board with a console that has not deployed:** the old console ignores the
  `rev` query parameter and never sends `204` or `X-Poll-Sec`, so the new
  firmware falls back to its old constants. Firmware can ship first safely.
- **Firmware versions that need the old path:** `round ≤ 0.5.28`,
  `simple ≤ 0.4.0` (the current releases). Simple `< 0.3.0` gets
  `{ rev, recipes: [] }` and never reports `rev`.
- **Removing the old path:** nothing to remove. `rev` stays optional; old
  boards keep working and keep showing **Unknown**.

## 4. Console design

### 4.1 Schema (`db/schema.sql`, `lib/ensure-schema.ts`)

```sql
alter table switches add column if not exists applied_rev integer;
alter table switches add column if not exists served_rev integer;
alter table switches add column if not exists apply_failed boolean not null default false;
alter table switches add column if not exists rev_changed_at timestamptz;
alter table switches add column if not exists editing_until timestamptz;
alter table switches add column if not exists next_poll_at timestamptz;
```

- `applied_rev`: last `rev` the switch reported (`null` = never reported).
- `served_rev`: revision in the last `200` or `204` sent to that switch.
- `apply_failed`: see §4.5.
- `rev_changed_at`: set to `now()` by every statement that changes `rev`
  (`incrementSwitchRev`, register, the channel-type cleanup, the Round product
  switch, `PUT /pages`, the auto-bump in §4.4). Shown on **Pending**.
- `editing_until`: set to `now() + 15 min` for every switch of the account
  while the Switches page is open and visible (it calls
  `POST /api/switches/sync` on load and every 30 s, which also returns the
  statuses the page shows), and for one switch when it is saved. The editor
  data is rendered on the server, so there is no per-switch `GET` to hook.
- `next_poll_at`: `now() + pollSec` on each device poll, for the UI.

### 4.2 `GET /api/device/config`

1. Authenticate, find the switch, `touchSwitch` (as today).
2. If `rev` parses: apply the auto-bump rule (§4.4), set `apply_failed`
   (§4.5), set `applied_rev = rev`.
3. Resolve the revision to serve (after any Round persist bump, as today).
4. Compute `pollSec` (§4.3); set `next_poll_at`.
5. If `rev` was sent and equals the revision to serve: `204` with `X-Poll-Sec`.
   Otherwise `200` with the full config plus `pollSec`, and the header.
6. Set `served_rev` to the revision served.

Steps 2 and 6 can share the `touchSwitch` update where possible, to keep this
to one or two writes per poll.

### 4.3 Poll interval (`pollSec`)

In this order:

1. **No config** for the switch (Simple: no channel settings; Round: no page
   recipes, since every Round has a default page)
   → **30 s**. A switch with nothing to do is almost certainly being set up.
2. `editing_until > now()` → **30 s**.
3. A newer `rev` is pending for this switch (`rev > applied_rev`, e.g. saved
   through another path) → **30 s**. It will get the change on this poll anyway;
   this just makes the confirmation (§2.4) and any follow-up saves quick.
4. Otherwise → **300 s**.

The values live in one place in `lib/` so they can be tuned. The firmware clamp
(30–3600 s) is the only hard limit.

Load estimate: a configured, idle switch makes 288 polls a day, almost all
`204` with no body. Each is one Vercel function call and one small update.

### 4.4 Auto-bump when the switch is ahead

On a poll where the reported `rev` is **greater** than `switches.rev` (the switch
holds a config from a console state that no longer exists, e.g. after a
database restore):

- If the console has config for that switch (channel settings or pages):
  set `rev = reported rev + 1` and `rev_changed_at = now()`, then serve it.
  The switch replaces NVS on this poll and ends up matching what the console
  shows.
- If the console has **no** config for it: do not bump. Serve as usual; the
  switch keeps its NVS because its `rev` is higher. Status **Ahead of
  console**, with a button on the switch page, "Replace the switch's config",
  that sets `rev = applied_rev + 1`. This keeps a restore to an empty database
  from wiping every switch on the wall.

### 4.5 Status (one helper in `lib/`)

`apply_failed` is set in §4.2 step 2: `true` when the incoming `rev` is lower
than the previous `served_rev` (the switch was already served that config and
did not keep it), otherwise `false`.

Status, in this order:

1. `applied_rev` is `null` → `unknown`.
2. `applied_rev > rev` → `ahead`.
3. `applied_rev == rev` → `current`.
4. `apply_failed` → `not_applied`.
5. Otherwise → `pending`.

### 4.6 UI

- Switches overview and the per-switch page: status next to "seen …".
- **Pending**: "Saved {rev_changed_at} · the switch checks in by
  {next_poll_at}". When `next_poll_at` is past and the switch hasn't polled,
  say it hasn't checked in since {last_seen_at}.
- **Not applied**: suggest connecting the switch over USB and checking its
  serial log.
- **Ahead of console**: explain that the switch keeps its own config and
  ignores the console until replaced; show the button from §4.4.
- **Unknown**: "Update the firmware to see sync status" when a newer release
  exists for that product.

## 5. Checklist

### Console (`hue-switch-console`)

- [ ] Schema columns (§4.1) in `db/schema.sql` and `lib/ensure-schema.ts`
- [ ] `rev_changed_at` set everywhere `rev` changes
- [ ] `editing_until` set on channels/pages `GET` and `PUT`
- [ ] `GET /api/device/config`: optional `rev`, auto-bump, `apply_failed`, `204`, `X-Poll-Sec` / `pollSec`, `served_rev`, `next_poll_at` (§4.2–§4.4)
- [ ] Status helper (§4.5); `applied_rev`, `config_status`, `next_poll_at` in `GET /api/switches` and `GET /api/switches/{mac}`
- [ ] UI (§4.6), including the "Replace the switch's config" action
- [ ] `docs/device-api.md` updated in the same commit (§2.5)
- [ ] `docs/changelog.md` entry
- [ ] Deployed; checked on production: old boards get `200` as before and show **Unknown**

### Round (`hue-round-switch`)

- [ ] `consoleFetchConfigHttp` appends `&rev=<gRecipeRev>`
- [ ] `204` handled as "keep NVS", no parse; nothing queued to the loop
- [ ] Read `X-Poll-Sec` on `200` and `204`; clamp 30–3600 s; fall back to the old constants when missing; 3600 s after `401` (§2.3)
- [ ] Confirmation poll after `consoleApplyConfig` replaces NVS (§2.4); the queue still keeps a second body from being sent before the first is applied or rejected
- [ ] `FIRMWARE_VERSION` bumped (from `0.5.28`)
- [ ] `CHANGELOG.md` entry in the firmware repo (user-facing wording)
- [ ] Release uploaded; `/firmware/round/manifest.json` shows the new version
- [ ] Tested on a board by the user: with the switch page open, save pages → **Up to date** within about a minute

### Simple (`hue-simple-switch`)

- [ ] `consoleFetchConfig` appends `&rev=<gRecipeRev>` (read under `recipesLock`)
- [ ] `204` handled as "keep NVS", no parse
- [ ] Read `X-Poll-Sec` on `200` and `204`; clamp 30–3600 s; fall back to the old constants when missing; 3600 s after `401` (§2.3)
- [ ] Confirmation poll after a successful `recipesSave()` with a new `rev` (§2.4)
- [ ] `FIRMWARE_VERSION` bumped (from `0.4.0`)
- [ ] `CHANGELOG.md` entry in the firmware repo (user-facing wording)
- [ ] Release uploaded; `/firmware/simple/manifest.json` shows the new version
- [ ] Tested on a board by the user: with the switch page open, save channels → **Up to date** within about a minute

### Cleanup

- [ ] None required; `rev` stays optional (§3)

## 6. Open questions

None. Checked while drafting: the Round screen timeout only changes through
`PUT /api/switches/{mac}/pages`, which bumps `rev`, so a `204` never hides a
timeout change.
