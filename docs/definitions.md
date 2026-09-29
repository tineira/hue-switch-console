# Definitions — Hue Wi‑Fi console and switches

Product and architecture document. Not an implementation guide or a changelog.

Three repos:

| Repo | Role |
| --- | --- |
| `hue-simple-switch` | XIAO ESP32-C6 firmware. GPIO press → Hue Bridge on the LAN (Clip v2). Channels `boot` and `d0`–`d5` (firmware < 0.5.0: `boot`, `d0`–`d2`). |
| `hue-round-switch` | XIAO ESP32-S3 + Round Display firmware. Tap on the circle, not pins. Pages: `docs/round-pages.md`. |
| `hue-switch-console` | Web app (Vercel + **Neon** Postgres). User account, topology, function assignment. This repo. |

The console **never** calls the Bridge. The Bridge **never** sees Vercel. A finger on the switch **never** waits for the web.

HTTP wire format: `docs/device-api.md`. Round pages: `docs/round-pages.md` (that copy is authoritative for state). Product boards are flashed and provisioned from the browser (**Setup**, `/setup`: firmware, Wi‑Fi and device token over USB); see `docs/device-api.md`.

## Parts

**Bridge.** Hue Bridge Pro on the LAN. Source of truth for lights, rooms, zones and scenes. Local Clip v2 API over HTTPS (self-signed certificate).

**Switch / XIAO.** Seeed XIAO Wi‑Fi board. It is not a Zigbee accessory and does not impersonate a Hue switch.

- **Simple:** several GPIO **channels**. The firmware declares `{ id, gpio, label }`; the user configures each `id` in the console (room or zone, type, target, scenes). The console does not pick the pin.
- **Round:** no recipe GPIO. The console defines **pages**; the poll returns `pages[]` + recipes with `pageId`. See `docs/round-pages.md`.

The **display name** is edited by the user in the console (`switches.label`); it is not sent to the device. If empty, the UI shows the MAC.

**Channel (Simple only).** One GPIO input. The **user** picks its `kind` in the console (spec: `docs/specs/finished/simple-channel-types.md`); both use the same wiring:

- `maintained` — UI *Wall switch*: classic wall switch, the circuit stays **closed** or **open** (two stable states).
- `momentary` — UI *Push button*: press and release.

Channels (declared by the firmware; closed = GPIO to GND, `INPUT_PULLUP`):

| id | GPIO | label | kind |
| --- | --- | --- | --- |
| `boot` | 9 | BOOT | always `momentary` |
| `d0` | 0 | D0 | user's choice |
| `d1` | 1 | D1 | user's choice |
| `d2` | 2 | D2 | user's choice |
| `d3` | 21 | D3 | user's choice |
| `d4` | 22 | D4 | user's choice |
| `d5` | 23 | D5 | user's choice |

Firmware < 0.5.0 declares only `boot` and `d0`–`d2`.

Do not use GPIO 3/14 (RF), 15 (LED), or USB.

**Console.** Next.js on Vercel. Human login. Receives snapshots and stores assignments. Host: `https://hue.tineira.com` (Cloudflare DNS → Vercel). **All UI (copy, buttons, errors) is English.**

**Postgres (Neon).** Accounts (`users`, plus Better Auth's `sessions`, `accounts` and `verifications`), device API keys, topology, recipes, Round pages. **Not Supabase Auth.** The human session is a Better Auth session cookie (`hsw.session_token`); sign-in runs inside the console (`docs/specs/finished/multi-user-accounts.md`). The runtime applies `db/schema.sql` and `lib/ensure-schema.ts`. Do not apply the migrations in `docs/archive/supabase-DO-NOT-APPLY/`.

**Hue application key.** Token the Bridge issues on pairing (`POST /api` with the Bridge button pressed). Lives in the XIAO's NVS. It is not the console API key.

**Console API key / `CONSOLE_TOKEN`.** Device token (`hsw_…`). The user **creates and manages** it in the console (name, copy once, revoke). The XIAO sends it as `Authorization: Bearer`. It cannot be used to sign in to the site.

**User account.** A person, identified by email. Hosted console: signs in with Google, GitHub or a 6-digit code emailed to them, no password. Sign-up follows `SIGNUP_MODE` (`closed`, `invite`, `waitlist`, `open`). The hosted console uses `waitlist`: people join a waitlist and are invited automatically while the console is below its seat cap, which the admin raises in `/admin` (`docs/specs/waitlist.md`). Self-hosted console without email: the seeded `USER_EMAIL` / `USER_PASSWORD` account with a password (`.env.local`, never commit). Everything an account owns (keys, Bridges, switches, recipes) is deleted with it. Per-account limits: 25 switches, 5 Bridges, 25 active keys, 512 KB snapshot (`docs/specs/finished/multi-user-accounts.md`).

**Topology.** Snapshot of **one Bridge**. Any XIAO paired to that `bridgeid` (or `push-from-bridge`) uploads it with `POST /api/device/register`. It is not "the switch's topology". The JSON must be enough to draw rooms and assign `rid`:

```text
{
  bridgeid, bridge_ip, receivedAt,
  lights:  [{ id, name, on, caps[] }],
  rooms:   [{ id, name, grouped_light_id, light_ids[], rtype? }],
  scenes:  [{ id, name, group_rtype, group_rid }]
}
```

`grouped_light_id` is the target for "the whole room". Scenes are listed under the room/zone whose `id` = `group_rid`. `lights` / `rooms` / `scenes` are **required** (arrays; `[]` is legal if the Bridge is empty). Omitting the field is a 400; an incomplete POST must not overwrite the tree.

**Recipe / assignment.** What to do when a **channel** (Simple) or a **page** (Round) emits an **event**. Defined by the user in the console. Copied to NVS.

**Event (what is read from the GPIO or the circle).** Not to be confused with the Hue action (`toggle`, `on`, `off`, `recall_scene`).

**NVS.** ESP32 flash storage. Holds the Bridge IP, Hue key, recipes (and Round pages) and `rev`. The GPIO / finger path uses only this.

**`config.h`.** Holds only `SERIAL_DEBUG`. Nothing else is compiled in, in dev or product:

- Wi‑Fi: saved over USB with Improv during install.
- Console URL + device token: written over USB (`HUESET`) into NVS `console`.
- Bridge IP, Hue key, recipes / pages: discovered, paired, or received by poll, and kept in NVS.

**Console account.** The login (Google, GitHub, emailed code, or password when self-hosted). Not a Hue "Home".

## Per Bridge (there is no Home)

This app does **not** model a home with several Bridges. That "Home" belongs to the official (cloud) app. Clip v2 does not have it and neither do we.

The configuration context is **one Bridge** (`bridgeid`):

- **Topology belongs to the Bridge**, not the switch. Lights, rooms, zones, scenes and `grouped_light` are a snapshot of that Bridge. Several XIAOs paired to the same Bridge **share** the same tree.
- **Several switches → one Bridge.** Each board registers (MAC, firmware, `product`, channel list or `[]`) against the `bridgeid` it paired with.
- A switch talks to **one** Bridge only (one IP, one Hue application key). Its recipes can only target `rid`s of that `bridgeid`.
- If another Bridge appeared, it would be **another context** (another screen / another `bridgeid`), not a parent "home" that joins them.

## Events read (`maintained` channel, Simple)

A wall switch **is not a firmware toggle**. The contact has state: closed = on, open = off. The XIAO reads **edges and a short pattern**; it does not "invert the lamp because someone pressed".

v1 events:

| Event | What happens in the circuit | Typical Hue use |
| --- | --- | --- |
| `on` | Goes **closed** and stays | `on` (turn target on) |
| `off` | Goes **open** and stays | `off` (turn target off) |
| `double_click` | Was **closed**, **opens** and **closes again** within a short window (e.g. &lt; 400 ms) | Third action: scene, brightness, another room |

`on`/`off` copy the wall lever to Hue (no GET). Double-click is an "extra" without a second lever.

Not needed in v1: triple click, long-off, double_off. Noise and long wires eat the double-click if the window is too short; it is calibrated in firmware.

**`momentary` channel** (push button): `short` (click), `double_click` (two clicks within the window), `hold` (held past ~800 ms; fires once while still pressed). A push button does **not** generate stable `on`/`off`. All three are configurable on every push button, BOOT included. BOOT's 3 s long press re-pairs with the Bridge unless BOOT has a `hold` recipe.

**Round:** does not use this GPIO state machine. Recipe events per page: `short` (tap) and `double_click` (double tap). There is **no** `double_click` → `on` fallback on the circle (empty slot = no-op). Details: `docs/round-pages.md`.

## Display and recipes (Simple: per channel and event)

A switch is configured against its own Bridge only. **Switches** shows every switch in the account as tabs, grouped in one section per `bridgeid`; each switch has its own URL (`/switches/<mac>`), and tabs move between switches without losing unsaved changes (pages: `docs/specs/finished/page-structure.md`). **Lights** is read-only: per Bridge, which switch gestures reach each room, zone and light, directly or through a group. Each gesture is configured where it is shown: it opens in place and offers only choices valid for it (layout: `docs/specs/finished/design-bridge-v2/`).

- **Simple:** switches, one per channel the user wired, plus BOOT. Each one gets a room or zone, a type (wall switch or push button), a target and an optional name. A wall switch adds a double-click scene list; a push button adds a double-click and a hold action. A pin with no switch does nothing. Layout: `docs/specs/finished/simple-editor-v2.md`.
- **Round:** **pages**, not GPIO. Room/zone group, tap / double tap, scene list, theme, axis, timeout. `docs/round-pages.md`.

The XIAO is not drawn inside the Hue tree. A gesture's light chips are the whole room or zone (`grouped_light`) and its lights; its scene chips are that group's scenes, shown only for Cycle scenes.

**Simple channel settings → recipes**

```text
switch + channelId → group (room | zone), kind, target (light | grouped_light), scenes[], double, hold
  maintained: on → on target · off → off target · double_click → recall_scene scenes[] (if any)
  momentary:  short → toggle target · double_click → double (if any) · hold → hold (if any)
```

The user edits channel settings; the console derives the recipes the switch runs. `toggle` (GET + invert) is a Hue action, not a GPIO event.

There is no loose multi-select of lights. There is no single recipe "for the switch".

On save, `rev` goes up. NVS stores the set. On register, the Simple firmware sends `{ id, gpio, label }[]` and `"product": "simple"`. Round sends `"product": "round"` and `channels: []`.

## Assign in the app, execute on the switch

The app **writes** recipes / pages. The switch **executes** them on the LAN. The GPIO / finger never calls Vercel.

### What the switch declares (register)

`POST /api/device/register` (device Bearer), along with the `bridgeid` and MAC:

- Simple: `product: "simple"`, GPIO channels.
- Round: `product: "round"`, `channels: []`.
- Snapshot: `lights[]`, `rooms[]`, `scenes[]` (required; a truly empty `[]` is legal).

The UI does not invent pins. If a channel is not sent, it cannot be assigned. The type the user picks decides which **events** the channel has (`on`/`off`/`double_click` vs `short`/`double_click`/`hold`).

Wipe round→simple **only** if the body carries an explicit `"product": "simple"`. Inferring from channels does not delete pages.

### How the user assigns (console, Simple)

1. Pick a **switch** tab. The editor shows the board picture (Top or 3D) and the list of switches, with **BOOT** pinned at the top.
2. Start with **BOOT**, the button on the board: pick a room or zone and save, then press BOOT to test before wiring anything. BOOT is always a push button.
3. **Add a switch** for each wired input: what it is (Wall switch or Push button), which free pin (D0–D5), which room or zone. Clicking a free pad on the board picture starts the same flow with that pin chosen.
4. Pick the **target** on the On / Off or Click card: the whole group (`grouped_light`) or one light of it. It defaults to the whole group. Optionally give the switch a **name** (console only, never sent to the board).
5. Wall switch: optionally add **scenes** for double-click (1–8, from the group, in order). Push button: **double-click** is nothing or Cycle scenes; **hold** is nothing, **Dim** (always dims what Click controls; it has no target of its own), or Turn off the whole room or zone (offered only when the click target is one light). On BOOT, a hold set to nothing is shown as **Re-pair with the Bridge**, and any other hold replaces re-pairing.
6. **Wired as → Change** switches the type or moves the switch to another free pin after rewiring. **Remove *name*** (e.g. "Remove Front door") deletes it and frees its pin; on BOOT, **Clear BOOT settings** goes back to re-pairing.

| Type | Gesture | What it does |
| --- | --- | --- |
| Wall switch | lever closes / opens | `on` / `off` the target (automatic) |
| Wall switch | double-click | next scene in the list; empty list → `on` (the lever ends up; the console says "Does nothing") |
| Push button | click | `toggle` the target (automatic) |
| Push button | double-click | next scene in the list; nothing = no-op |
| Push button | hold | dim the click target, or turn off the whole group; nothing = no-op (BOOT: re-pair) |

If the target is one light, a scene still applies to the whole group; the console warns.

Each gesture card sums up its gesture in words (not UUIDs): *"Lever up turns on, down turns off all of Living"*, *"Cycles Relax → Bright"*.

Validate on save: channel registered; BOOT is a push button; group is in that `bridgeid`'s snapshot; target and scenes belong to the group; only wall switches have a scene list; only push buttons have double-click and hold actions. A name is at most 40 characters. A Simple on firmware < 0.3.0 cannot be edited: the console asks to update it.

`rev` increments. That is what the poll compares.

Round: Save (PUT pages) **requires a group** on every page. The device register may create `p1` without a group. See `docs/round-pages.md`.

### Contract the switch downloads

`GET /api/device/config?mac=` (device Bearer). It does **not** include the topology.

**Simple:**

```text
{
  rev: 12,
  product: "simple",
  channels: [ { id: "d0", kind: "maintained", group: { rtype, rid, groupedLightRid } }, … ],
  recipes: [
    { channelId: "d0", event: "on", action: "on", target: { rtype: "grouped_light", rid: "…" } },
    { channelId: "d0", event: "double_click", action: "recall_scene", targets: [ { rtype: "scene", rid, name }, … ] },
    …
  ]
}
```

Firmware < 0.3.0 gets `{ rev, recipes: [] }`.

**Round** (`product: "round"`): `rev`, `product`, `pageSwipeAxis`, `screenTimeoutSec`, `pages[]` (with `group` + `dim`), `recipes[]` with `pageId`. See `docs/round-pages.md` §11.2 and `docs/device-api.md`.

If local `rev` ≥ remote `rev`, the firmware does **not** write NVS. If remote is higher, it **replaces** the whole local array (and pages). `rev = 0` is never used as an "empty" flag: a `bridgeid` change **deletes** recipes/pages and **increments** `rev`.

### What the firmware must do (Simple)

Channels come from `channels[]` in the config; a pin not listed is ignored. For each `maintained` channel (contact to GND = closed, pull-up, ~50 ms debounce):

1. Read the GPIO. Stable closed/open state.
2. **Double-click** state machine (important: do not fire `off` then `on` if it was a double):
   - Closed → open: do **not** fire `off` yet. Start a window (~300–500 ms).
   - If it closes again within the window: `double_click` event (and **no** `off` or `on`).
   - If the window expires open: `off` event.
   - Open → closed **with no** pending window: `on` event.
3. Look up the `(channelId, event)` recipe in NVS. If the event is `double_click` and there is **no** recipe for that slot, treat it as `on` (the contact ended closed; the user expects the light on). Any other miss: no-op.
4. Execute on the Bridge (HTTPS Clip v2, Hue key in NVS):

| `action` | Clip v2 |
| --- | --- |
| `on` | `PUT …/{rtype}/{rid}` `{ "on": { "on": true } }` |
| `off` | same with `false` |
| `recall_scene` | `PUT …/scene/{rid}` `{ "recall": { "action": "active" } }`, next `rid` of `targets[]` (Round §8.1; an `off` on the channel restarts the cycle) |
| `toggle` | GET `on` + inverse PUT (mostly `momentary` / `short`) |
| `dim` (`hold` only) | GET `on` + `dimming`; if off, turn on at 1 %. Then cycle while held: first leg **up** below 30 % (or from off), **down** otherwise; each leg `{ "dimming_delta": { "action": "up" \| "down", "brightness_delta": 100 }, "dynamics": { "duration": <ms> } }` timed from the distance left (3 s for a full sweep), a 400 ms pause at each end, then the other way; stops by itself after 30 s. On release `{ "dimming_delta": { "action": "stop" } }`. Never turns the light off. Simple < 0.7.0 ramps one way per hold over 5 s, alternating direction. Spec: `docs/specs/simple-dim-cycle.md` |

5. The contact path does **not** use the console URL. If the PUT fails, log and move on; do not block other channels.

`momentary` channel: `short` on release, **immediately** when the channel has no `double_click` recipe (otherwise after the window); `double_click` on the second press; `hold` once at ~800 ms while pressed. BOOT with no `hold` recipe: 3 s long press → re-pair. BOOT with a `hold` recipe: never re-pairs from the button (USB install only).

At boot: load recipes from NVS **before** handling GPIO. The first read of each GPIO **only sets the state**; it does not fire `on`/`off`. Then Wi‑Fi, poll, etc.

If the user changes a recipe in the app, the switch learns about it on the poll. The console sets the interval: 30 s while the switch has no config or the Switches page is open, 15 min otherwise (firmware from before this change: 1 min with no recipes, else every 1 h). Reboot = fetch recipes now; it does not fire GPIO events. Each poll reports the `rev` in NVS, so the console shows whether the switch runs the saved config (`docs/specs/finished/config-sync.md`).

**Other rules:**

- The config `GET` **replaces** the recipe array in NVS (not a patch). Slots no longer sent are deleted.
- If the paired `bridgeid` changes: the firmware drops the recipes in NVS **and** the console deletes them + increments `rev` (defense in depth).
- Two switches (or the Hue app) on the same target: **last event wins**. No 3-way wiring or lever syncing.
- Console chrome in English; **Hue names** (Living, Velador Tomás) are shown as they are.
- Several topology POSTs for the same `bridgeid`: **last good snapshot wins**. A register without `rooms`/`scenes` (omitted) is a 400; it does not overwrite.
- Revoked API key: the poll fails; recipes in NVS **keep** running on the LAN.
- Sign-up follows `SIGNUP_MODE`: `closed` (only the seeded `USER_EMAIL`), `invite` (the admin approves each waitlist entry), `waitlist` (admitted automatically up to the seat cap) or `open`. A suspended account gets `403 account_suspended` on device calls; its NVS recipes keep running.
- Orphan recipe (the `rid` is no longer in the snapshot): kept; the Hue PUT fails; the UI marks it stale.

## Two doors

| Who | How |
| --- | --- |
| User in the browser | Google, GitHub or emailed code (password when self-hosted without email); Better Auth session cookie |
| XIAO or `push-from-bridge` | `CONSOLE_TOKEN` (device API key) |

The signed-in user **creates and manages** API keys in the console: create, name, copy (once), revoke. Each key is a device token. Several XIAOs can share one, or use one per board (better for revoking). There is no permanent `INGEST_TOKEN` on the server. `POST /api/ingest` returns `410 gone`; use `POST /api/device/register`.

## First boot of the XIAO

No recipes yet.

1. Connects to Wi‑Fi (saved over USB during install).
2. Discovers the Bridge (`mDNS _hue._tcp`, then NVS, `discovery.meethue.com`).
3. If there is no valid Hue key: LED / circle blinks, `POST /api` until the Bridge button is pressed. Key and IP go to NVS.
4. **Register + upload:** MAC, `product`, `bridgeid`, channels or `[]`, rich snapshot to `POST /api/device/register`.
5. Asks for config → Simple: `recipes: []`; Round: empty page `p1`, often without a group until Save in the console.
6. Channels / the circle do not fire Hue (empty slots). Poll every ~1 minute.

The user assigns (channels or pages). The next poll (if remote `rev` > local) writes NVS and they start executing.

## Polling

| State | Rate | What it asks |
| --- | --- | --- |
| No recipes / pages in NVS | ~1 min | Is there config? (`rev`) |
| Some recipes / pages already | At boot and every 1 h | New `rev`? |

If the user changes recipes on the web, the XIAO can take up to 1 h unless rebooted (reboot = "apply now"). The GPIO / finger do not use Vercel: NVS → Bridge.

## What this is not

- The console is not the light's path (there is no "app in the middle" when pressing).
- Vercel cannot reach `192.168.x.x`; the Bridge IP identifies the device on the LAN, it does not open a tunnel.
- No remote Hue API in v1.
- No Zigbee, no impersonating Hue accessories, no mixing this tree with the Arduino sketches.

## Infrastructure (done)

| What | For | Status |
| --- | --- | --- |
| **Vercel** project (`hue-switch-console`) | Build and serverless | Done |
| **Neon** Postgres | Accounts, API keys, topology, recipes, pages | Done (`db/schema.sql`) |
| **Cloudflare** DNS: `hue.tineira.com` → Vercel | The XIAO's console URL | Done |
| Auth | Better Auth in the console (Google, GitHub, emailed code; password when self-hosted); seed `USER_EMAIL` / `USER_PASSWORD` | Done. Not Supabase Auth |
| API keys UI | Create, copy once, revoke | Done |
| Rich snapshot + Bridge screen | Simple = channels; Round = pages | Done |

Production host: `https://hue.tineira.com`. In Cloudflare, CNAME `hue` to the target Vercel gives; TLS at the edge.

## Settled (do not reinvent)

- UI in **English**. Firmware serial output: English.
- Switch id = ESP32 MAC (hex). A device API key belongs to an account; the switch that registers with that key belongs to that account.
- API key: shown **once**, stored as a hash (SHA-256); the list shows only name + prefix.
- HTTPS to `hue.tineira.com`: **verify** the certificate (Arduino bundle). `setInsecure()` only against the Hue Bridge.
- Poll: without recipes ~1 min; with recipes at boot and every **1 h**. GPIO / finger never wait.
- Orphan recipe: kept; the Hue PUT fails; the UI marks it stale.
- Wall-switch double-click without scenes → runs `on`. On the circle, empty slot = no-op. Boot does not synthesize GPIO events. Poll replaces the set if remote `rev` > local. Last event wins. A `bridgeid` change deletes recipes/pages **and bumps `rev`**. Sign-up only as `SIGNUP_MODE` allows.
- Minimal API:
  - Human (session cookie): sign in; CRUD API keys; GET topology; PATCH switch label; PUT channels (Simple) / PUT pages (Round).
  - Device (Bearer key): `POST /api/device/register`; `GET /api/device/config?mac=` (Simple: `rev`, `product`, `channels[]`, `recipes[]`; Round: `pages`, `pageId`, axis, timeout).
- Tables (Neon): `users`, `device_api_keys`, `bridges` (snapshot JSON), `switches` (`product`, axis, timeout), `pages`, `recipes` (Round), `simple_channels`. The server filters by `user_id`; there is no Supabase RLS.

## Repos

- Simple: [github.com/tineira/hue-simple-switch](https://github.com/tineira/hue-simple-switch)
- Round: [github.com/tineira/hue-round-switch](https://github.com/tineira/hue-round-switch)
- Console: [github.com/tineira/hue-switch-console](https://github.com/tineira/hue-switch-console)
