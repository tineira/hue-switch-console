# Device API

Contract for the XIAO firmware (`hue-simple-switch`) and `push-from-bridge`.
Postgres is the source of truth. There is no server-side `INGEST_TOKEN`.

## Host and TLS

```
CONSOLE_URL=https://hue.tineira.com
```

Dev: that URL and a console API key in `config.h`. Product install (flash + Wi-Fi + token from Chrome) shipped; `docs/specs/finished/web-setup.md` is closed and deprecated. Setup (`/setup`, formerly Devices: detect, then those actions) is implemented; the spec is `docs/specs/finished/devices.md`. OTA + firmware in the switch list: `docs/specs/ota.md` (approved, not implemented; Simple first).

Device TLS **must verify** the console certificate (Arduino ESP32 cert bundle).
Do **not** call `setInsecure()` for `CONSOLE_URL`. `setInsecure()` is only for
the Hue Bridge (self-signed).

Local dev: `CONSOLE_URL=http://localhost:3000` (no TLS).

The installer writes the console URL over USB (`HUESET url`). Firmware accepts any `http://` or `https://` URL that fits, with no host allowlist. This is on purpose: self-hosted consoles, often plain `http://` on a LAN, must work. Writing it needs physical USB access, which can reflash the board anyway.

## Auth

Device endpoints use the console API key, not a Hue application key and not a
human login.

```
Authorization: Bearer <CONSOLE_TOKEN>
Content-Type: application/json
```

The token looks like `hsw_…`. The server stores **SHA-256(token)** only. A
revoked or unknown key returns `401`. Recipes already in NVS keep running on
the LAN.

Human UI uses a Better Auth session cookie (`hsw.session_token`), obtained by
Google, GitHub or an emailed code on the hosted console, or by a password on a
self-hosted console without email. Sign-up and accounts:
`docs/specs/finished/multi-user-accounts.md`. That cookie is **not** valid as a device
Bearer token.

Errors are JSON: `{ "error": "<code>", "details"?: "…" }`.

| Status | error |
| --- | --- |
| 400 | `invalid_json`, `invalid_payload`, `validation_error`, or a field message |
| 401 | `unauthorized` |
| 403 | `account_suspended`: the key's owner is suspended. NVS recipes keep running, as with a revoked key. |
| 403 | `limit_reached` (`register` only): it would create a **new** switch or Bridge past the account's limit. `details`: `"switches"` or `"bridges"`. Updates to existing ones are never refused. |
| 404 | `not_found` |
| 410 | `gone` (`/api/ingest` only) |
| 413 | `payload_too_large` (`register` only): body over the account's snapshot limit (512 KB by default) |
| 429 | `rate_limited`: too many requests from one IP (Vercel Firewall rule on `/api/device/*`). `Retry-After` in seconds. |
| 503 | `database_not_configured` |

Firmware treats every non-200 except `401` as a failed call and retries on its
normal schedule, so `403`, `413` and `429` need no firmware change.

MAC is 12 hex digits, case-insensitive, `:` / `-` allowed on input. Stored and
returned lowercase without separators (`aabbccddeeff`).

---

## `POST /api/device/register`

Register this switch (if `mac` is present) and replace the topology snapshot
for `bridgeid`. Last snapshot for that `bridgeid` wins. Several XIAOs paired
to the same bridge share one tree.

If the switch was already registered and `bridgeid` changes, stored recipes,
pages and Simple channel settings for that MAC are deleted and `rev` is **incremented** (never reset to
`0` as an “empty” signal). Firmware writes NVS only when remote `rev` is
greater than local.

### Request

```
POST /api/device/register HTTP/1.1
Host: hue.tineira.com
Authorization: Bearer hsw_…
Content-Type: application/json
```

```json
{
  "mac": "aabbccddeeff",
  "firmware": "0.3.0",
  "bridgeid": "C42996FFFECA6703",
  "bridge_ip": "192.168.100.12",
  "source": "xiao",
  "channels": [
    { "id": "boot", "gpio": 9, "label": "BOOT" },
    { "id": "d0", "gpio": 0, "label": "D0" },
    { "id": "d1", "gpio": 1, "label": "D1" },
    { "id": "d2", "gpio": 2, "label": "D2" }
  ],
  "lights": [
    { "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "name": "Velador", "on": true, "caps": ["dim", "ct"] }
  ],
  "rooms": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "name": "Living",
      "grouped_light_id": "66666666-7777-8888-9999-000000000000",
      "light_ids": ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      "rtype": "room"
    }
  ],
  "scenes": [
    {
      "id": "99999999-aaaa-bbbb-cccc-dddddddddddd",
      "name": "Relax",
      "group_rtype": "room",
      "group_rid": "11111111-2222-3333-4444-555555555555"
    }
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `bridgeid` | yes | Hue bridge id |
| `lights` | yes | **Required array** (omit or non-array → 400). May be empty `[]` if the Bridge really has no lights. Each item needs `id`, `name`. `on`, `caps[]` optional |
| `rooms` | yes | **Required array** (omit or non-array → 400). May be empty `[]`. `id`, `name` required. `grouped_light_id` is the room-wide target. `light_ids[]` are light resource ids in that room/zone. `rtype` is optional (`room` \| `zone`) |
| `scenes` | yes | **Required array** (omit or non-array → 400). May be empty `[]`. `id`, `name` required. `group_rtype` / `group_rid` locate the scene under a room or zone |
| `channels` | yes when registering a GPIO board | `{ id, gpio, label }`: the pins the board has. Empty array allowed. Round Display may send `[]`. Simple firmware < 0.3.0 also sends `kind` (`maintained` \| `momentary`); it is accepted and ignored, because the user picks each channel's type in the console. Simple firmware ≥ 0.5.0 sends `boot` and `d0`–`d5` (seven channels); older Simple firmware sends `boot`, `d0`–`d2` |
| `product` | current firmware: yes | `"round"` or `"simple"`. Current boards **send** it. If omitted (old boards), inferred from empty/`c1` channels (round) vs GPIO (simple). Wipe round→simple **only** when the body has `"product": "simple"` explicitly — inference never deletes pages |
| `mac` | firmware: yes | Omit for `push-from-bridge` topology-only upload |
| `firmware` | no | Free string |
| `label` | no | Console display name on **first** insert only. Later registers do not overwrite a name set in the UI. Not sent to the board |
| `bridge_ip` | no | LAN address of the Bridge; not a tunnel |
| `source` | no | Default `xiao` if `mac` is set, else `unknown`. Script uses `push-from-bridge` |

`push-from-bridge` may omit `mac` / `firmware` / `channels` and still replace
the snapshot.

### Response `200`

```json
{
  "ok": true,
  "mac": "aabbccddeeff",
  "bridgeid": "C42996FFFECA6703",
  "rev": 12,
  "product": "simple",
  "lights": 1,
  "rooms": 1,
  "scenes": 1
}
```

`product` is included when `mac` is present. Without `mac`, `mac`, `rev`, and
`product` are omitted.

---

Round Display firmware sends `"product": "round"` and `channels: []`.
Placeholder `c1` (gpio 0) is still accepted and treated as round. Simple-switch
boards send `"simple"` with GPIO channels. Omitted `product` is inferred only
for old boards.

---

## `GET /api/device/config?mac={mac}&rev={rev}`

Poll recipes. Does **not** return topology. Compare `rev` to NVS: if remote
`rev` is greater, **replace** the whole local set (channels, pages, recipes).
If local `rev` ≥ remote, do not write NVS.

### Request

```
GET /api/device/config?mac=aabbccddeeff&rev=11 HTTP/1.1
Host: hue.tineira.com
Authorization: Bearer hsw_…
```

`mac` is required (query). Same hex rules as register.

`rev` is optional: the recipe revision stored in NVS, a non-negative decimal
integer read at request time (`0` = nothing applied yet). The console records
it to show whether the switch runs the saved config
(`docs/specs/finished/config-sync.md`). Missing or malformed `rev` is ignored: no `400`,
and the response is always a full `200`.

### Response `204`

When the request carries `rev` and it equals the revision the console would
serve, the response is `204 No Content` with no body. Keep NVS; there is
nothing to parse.

A `rev` **greater** than the console's means the switch holds a config from a
console state that no longer exists (e.g. after a database restore). If the
console has a config for that switch, it moves its `rev` past the switch's and
answers `200`, so the console's config replaces NVS. If it has none, it leaves
`rev` alone and the switch keeps NVS.

### `X-Poll-Sec`

Every `200` and `204` carries the header `X-Poll-Sec: <seconds>`, the delay
until the next poll. A `200` body also carries `"pollSec"` with the same value
(for logs; firmware reads the header). The console decides the value; today it
is 30 s while the switch has no config, while its owner has the Switches page
open (or saved in the last 15 min), and while the switch is behind; 900 s
otherwise (300 s before the multi-user accounts change). A switch on the 900 s
poll picks up the fast poll only at its next check-in.

### Response `200`

Simple switch (firmware ≥ 0.3.0):

```json
{
  "rev": 12,
  "product": "simple",
  "channels": [
    {
      "id": "d0",
      "kind": "maintained",
      "group": {
        "rtype": "room",
        "rid": "11111111-2222-3333-4444-555555555555",
        "groupedLightRid": "66666666-7777-8888-9999-000000000000"
      }
    },
    {
      "id": "boot",
      "kind": "momentary",
      "group": {
        "rtype": "room",
        "rid": "11111111-2222-3333-4444-555555555555",
        "groupedLightRid": "66666666-7777-8888-9999-000000000000"
      }
    }
  ],
  "recipes": [
    {
      "channelId": "d0",
      "event": "on",
      "action": "on",
      "target": { "rtype": "grouped_light", "rid": "66666666-7777-8888-9999-000000000000" }
    },
    {
      "channelId": "d0",
      "event": "off",
      "action": "off",
      "target": { "rtype": "grouped_light", "rid": "66666666-7777-8888-9999-000000000000" }
    },
    {
      "channelId": "d0",
      "event": "double_click",
      "action": "recall_scene",
      "targets": [
        { "rtype": "scene", "rid": "99999999-aaaa-bbbb-cccc-dddddddddddd", "name": "Relax" }
      ]
    },
    {
      "channelId": "boot",
      "event": "short",
      "action": "toggle",
      "target": { "rtype": "light", "rid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }
    }
  ]
}
```

- `channels[]` lists only the channels the user configured. A pin that is not
  listed does nothing. `kind` is `maintained` (wall switch) or `momentary`
  (push button); the user picks it, not the firmware.
- The console **derives** the recipes from each channel: a wall switch gets
  `on` + `off` on its target and, if it has scenes, `double_click` →
  `recall_scene`; a push button gets `short` → `toggle` plus its `double_click`
  and `hold` actions, when set.
  With no `hold` recipe, BOOT's 3 s long press re-pairs with the Bridge; with
  one, the button never re-pairs (only USB install does).
- A scene list is `targets[]` (1–8 scenes, same rules as Round §8.1: cycle from
  the last scene this channel set, wrap, start at the first when there is none;
  an `off` on the channel clears the last scene; skip scenes that return 404).
- Empty assignment: `{ "rev": 7, "product": "simple", "channels": [], "recipes": [] }`.

Simple firmware older than 0.3.0 gets `{ "rev": 12, "recipes": [] }`: it
cannot run channel settings, so it does nothing until it is reflashed. Its
old per-slot recipes were deleted when the console moved to channel types
(`docs/specs/finished/simple-channel-types.md`).

If the board is a Round Display (`product: "round"`), the payload is instead:

```json
{
  "rev": 12,
  "product": "round",
  "pageSwipeAxis": "horizontal",
  "screenTimeoutSec": 30,
  "pages": [
    {
      "id": "p1",
      "name": "Living",
      "theme": "ember",
      "group": {
        "rtype": "room",
        "rid": "…",
        "groupedLightRid": "…"
      },
      "dim": { "mode": "group", "rid": "…" }
    }
  ],
  "recipes": [
    {
      "pageId": "p1",
      "event": "short",
      "action": "recall_scene",
      "targets": [
        { "rtype": "scene", "rid": "…", "name": "Relax" }
      ]
    },
    {
      "pageId": "p1",
      "event": "double_click",
      "action": "off",
      "target": { "rtype": "grouped_light", "rid": "…" }
    }
  ]
}
```

`pages[].group` is the room or zone. `pages[].dim` is `null` (no ring),
`{ "mode": "group", "rid" }` (the page's `grouped_light`), or
`{ "mode": "lights", "rids": ["…"] }` (child lights from tap/double). There is
no `dimTarget`.

Limits the Round firmware relies on, and the console never exceeds: at most
**6 pages**, at most **2** `dim.rids` (the tap and double-tap lights), and so
at most 12 recipes (the firmware keeps 16). Anything past a limit is dropped
on the board without an error, so a console change that raises one needs a
spec and a firmware release first.

A Simple switch runs at most 7 channels and 21 recipes (3 per channel).

Unknown MAC for this key’s account: `404`.

| Recipe field | Values |
| --- | --- |
| `event` | Simple: `on` \| `off` \| `double_click` (maintained) or `short` \| `double_click` \| `hold` (momentary). Round: `short` \| `double_click` |
| `action` | `on` \| `off` \| `recall_scene` \| `toggle` \| `dim` (Simple `hold` only, firmware ≥ 0.4.0) |
| `target` | `{ rtype: light \| grouped_light, rid }` for `on` / `off` / `toggle` / `dim` |
| `targets[]` | 1–8 `{ rtype: scene, rid, name }` for `recall_scene` |

A wall switch's and a push button's `double_click` are always a scene list.
A push button's `hold` is `off` on the group's `grouped_light` (only when the
click target is one light) or `dim`: ramp the target with Clip v2
`dimming_delta` while held, `stop` on release, alternating up and down
(`docs/specs/finished/simple-hold-dim.md` §2.3). Simple 0.3.x drops a `dim` recipe and
keeps the rest, so its hold does nothing (BOOT still re-pairs).

Poll cadence (firmware):

- At boot and after re-pairing: poll now.
- After a `200` or `204`: wait `X-Poll-Sec`, clamped to 30–3600 s. When the
  header is missing (older console): no recipes in NVS → about 1 minute;
  recipes → every 1 hour.
- After replacing NVS with a new `rev`: poll once more right away, reporting
  the new `rev` (a confirmation; the answer is `204`). Not after keeping NVS or
  a parse failure.
- After `401`: wait 3600 s.
- Other errors: retry as before.

GPIO never waits on this GET.

---

## Human APIs (session cookie, not the device token)

Used by the console UI. Firmware does not call these.

| Method | Path | Body / result |
| --- | --- | --- |
| `GET` | `/api/keys` | `{ keys: [{ id, name, prefix, created_at, last_used_at }] }` |
| `POST` | `/api/keys` | `{ "name": "Kitchen XIAO" }` → includes `token` **once** |
| `DELETE` | `/api/keys/{id}` | revoke |
| `GET` | `/api/bridges` | snapshots |
| `GET` | `/api/bridges/{bridgeid}` | one snapshot |
| `GET` | `/api/switches` | registered boards; each has `applied_rev` (or `null`), `config_status` (`current` \| `pending` \| `not_applied` \| `ahead` \| `unknown`), `rev_changed_at`, `next_poll_at` |
| `GET` | `/api/switches/{mac}` | `{ found: false }` or `{ found: true, last_seen_at, firmware, label, key_revoked, applied_rev, config_status, next_poll_at }` (Setup reads it after Detect) |
| `POST` | `/api/switches/sync` | the Switches page calls it every 30 s while visible: every switch polls fast for 15 min; returns `{ switches: [{ mac, rev, applied_rev, config_status, rev_changed_at, next_poll_at, last_seen_at }] }` |
| `POST` | `/api/switches/{mac}/replace-config` | switch `ahead`: moves `rev` past the switch's so its next poll takes the console's config. `409 not_ahead` otherwise |
| `PATCH` | `/api/switches/{mac}` | `{ "label": "Kitchen" }` or `{ "label": null }` — console display name |
| `GET` | `/api/switches/{mac}/channels` | Simple channel settings (`channelSettings[]`). Round Display: `400 round_switch_uses_pages` |
| `PUT` | `/api/switches/{mac}/channels` | replace Simple channel settings; increments `rev`. Round: `400 round_switch_uses_pages` |
| `GET` | `/api/switches/{mac}/pages` | round pages + recipes |
| `PUT` | `/api/switches/{mac}/pages` | replace pages, swipe axis, timeout, and page recipes; increments `rev`. Every page must have a group |

### `PUT /api/switches/{mac}/channels`

```
PUT /api/switches/aabbccddeeff/channels HTTP/1.1
Cookie: __Secure-hsw.session_token=…
Content-Type: application/json
```

```json
{
  "channels": [
    {
      "id": "d0",
      "kind": "maintained",
      "group": { "rtype": "room", "rid": "11111111-2222-3333-4444-555555555555" },
      "target": { "rtype": "grouped_light", "rid": "66666666-7777-8888-9999-000000000000" },
      "scenes": ["99999999-aaaa-bbbb-cccc-dddddddddddd"],
      "double": null,
      "hold": null
    },
    {
      "id": "boot",
      "kind": "momentary",
      "group": { "rtype": "room", "rid": "11111111-2222-3333-4444-555555555555" },
      "target": { "rtype": "light", "rid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
      "scenes": [],
      "double": null,
      "hold": null
    }
  ]
}
```

A channel left out is not used. `scenes` is the wall-switch double-click
list. For a push button, `double` is `null` or
`{ "action": "recall_scene", "targets": ["<scene rid>", …] }`, and `hold` is
`null`, `{ "action": "dim", "target": … }`, or
`{ "action": "off", "target": { "rtype": "grouped_light", "rid": "<the group's>" } }`.
On BOOT, `hold: null` means the 3 s press re-pairs with the Bridge.

A `dim` hold dims what Click controls: the console stores its `target` as the
channel's `target`. A body with a different `dim` target is not refused; the
console replaces it with the channel's `target` and returns the result.

`label` is optional: the name the user gives the switch, shown only in the
console and never sent to the board (`GET /api/device/config` leaves it out).
A string is trimmed, and an empty string or `null` clears it. A channel sent
without `label` keeps the name already stored, so a page opened before names
existed cannot erase them. The response's `channels` carry `label`.

Validation, with the `error` code:

| Rule | `error` |
| --- | --- |
| `id` is a channel the switch registered, listed once | `invalid_channel` |
| `boot` is `momentary`; only `maintained` has `scenes`; only `momentary` has `double` / `hold`; `double` is a scene list; `hold` is `dim` or `off` | `channel_kind_not_allowed` |
| `target` is the group's `grouped_light` or one of its lights (a `dim` hold takes the same target); an `off` hold targets the group's `grouped_light` | `target_outside_group` |
| An `off` hold while the click target is already the whole group | `validation_error` |
| `label` is a string or `null`, at most 40 characters after trimming | `validation_error` (a non-string is a 400 on the body) |
| Every scene belongs to the group | `scene_outside_group` |
| `group` is a room or zone in the snapshot; `scenes` holds 0–8, a `double` / `hold` list 1–8, no duplicates | `validation_error` |
| Switch firmware is older than 0.3.0 | `409 firmware_update_required` |

Response:

```json
{ "ok": true, "mac": "aabbccddeeff", "rev": 13, "channels": [ ] }
```

---

## Removed

`POST /api/ingest` and `GET /api/ingest` return `410 gone`. Use
`POST /api/device/register`.

`GET` and `PUT /api/switches/{mac}/recipes` return `410 gone`. Simple
switches use `/api/switches/{mac}/channels`; Round uses `/pages`.
