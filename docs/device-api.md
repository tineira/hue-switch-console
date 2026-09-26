# Device API

Contract for the XIAO firmware (`hue-simple-switch`) and `push-from-bridge`.
Postgres is the source of truth. There is no server-side `INGEST_TOKEN`.

## Host and TLS

```
CONSOLE_URL=https://hue.tineira.com
```

Dev: that URL and a console API key in `config.h`. Product install (flash + Wi-Fi + token from Chrome) shipped; `docs/specs/web-setup.md` is closed and deprecated. Devices (detect, then those actions) is implemented; the spec is `docs/specs/finished/devices.md`. OTA + firmware in the switch list: `docs/specs/ota.md` (not implemented).

Device TLS **must verify** the console certificate (Arduino ESP32 cert bundle).
Do **not** call `setInsecure()` for `CONSOLE_URL`. `setInsecure()` is only for
the Hue Bridge (self-signed).

Local dev: `CONSOLE_URL=http://localhost:3000` (no TLS).

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

Human UI uses a session cookie `hsw_session` (email + password against Neon
`users`, not Supabase Auth). No public signup. That cookie is **not** valid as
a device Bearer token.

Errors are JSON: `{ "error": "<code>", "details"?: "…" }`.

| Status | error |
| --- | --- |
| 400 | `invalid_json`, `invalid_payload`, `validation_error`, or a field message |
| 401 | `unauthorized` |
| 404 | `not_found` |
| 410 | `gone` (`/api/ingest` only) |
| 503 | `database_not_configured` |

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
| `channels` | yes when registering a GPIO board | `{ id, gpio, label }`: the pins the board has. Empty array allowed. Round Display may send `[]`. Simple firmware < 0.3.0 also sends `kind` (`maintained` \| `momentary`); it is accepted and ignored, because the user picks each channel's type in the console |
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

## `GET /api/device/config?mac={mac}`

Poll recipes. Does **not** return topology. Compare `rev` to NVS: if remote
`rev` is greater, **replace** the whole local set (channels, pages, recipes).
If local `rev` ≥ remote, do not write NVS.

### Request

```
GET /api/device/config?mac=aabbccddeeff HTTP/1.1
Host: hue.tineira.com
Authorization: Bearer hsw_…
```

`mac` is required (query). Same hex rules as register.

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
  listed does nothing. `kind` is `maintained` (toggle switch) or `momentary`
  (push button); the user picks it, not the firmware.
- The console **derives** the recipes from each channel: a toggle switch gets
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
(`docs/specs/simple-channel-types.md`).

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

Unknown MAC for this key’s account: `404`.

| Recipe field | Values |
| --- | --- |
| `event` | Simple: `on` \| `off` \| `double_click` (maintained) or `short` \| `double_click` \| `hold` (momentary). Round: `short` \| `double_click` |
| `action` | `on` \| `off` \| `recall_scene` \| `toggle` |
| `target` | `{ rtype: light \| grouped_light, rid }` for `on` / `off` / `toggle` |
| `targets[]` | 1–8 `{ rtype: scene, rid, name }` for `recall_scene` |

A toggle switch's `double_click` is always a scene list. A push button's
`double_click` and `hold` are any action with a target in the group, or a
scene list.

Poll cadence (firmware): no recipes in NVS → about 1 minute; after recipes
exist → at boot and every 1 hour. GPIO never waits on this GET.

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
| `GET` | `/api/switches` | registered boards |
| `PATCH` | `/api/switches/{mac}` | `{ "label": "Kitchen" }` or `{ "label": null }` — console display name |
| `GET` | `/api/switches/{mac}/channels` | Simple channel settings (`channelSettings[]`). Round Display: `400 round_switch_uses_pages` |
| `PUT` | `/api/switches/{mac}/channels` | replace Simple channel settings; increments `rev`. Round: `400 round_switch_uses_pages` |
| `GET` | `/api/switches/{mac}/pages` | round pages + recipes |
| `PUT` | `/api/switches/{mac}/pages` | replace pages, swipe axis, timeout, and page recipes; increments `rev`. Every page must have a group |

### `PUT /api/switches/{mac}/channels`

```
PUT /api/switches/aabbccddeeff/channels HTTP/1.1
Cookie: hsw_session=…
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

A channel left out is not used. `scenes` is the toggle-switch double-click
list. `double` and `hold` (push button only) are `null`,
`{ "action": "on" | "off" | "toggle", "target": … }`, or
`{ "action": "recall_scene", "targets": ["<scene rid>", …] }`. On BOOT,
`hold: null` means the 3 s press re-pairs with the Bridge.

Validation, with the `error` code:

| Rule | `error` |
| --- | --- |
| `id` is a channel the switch registered, listed once | `invalid_channel` |
| `boot` is `momentary`; only `maintained` has `scenes`; only `momentary` has `double` / `hold` | `channel_kind_not_allowed` |
| `target` (and a `double` / `hold` target) is the group's `grouped_light` or one of its lights | `target_outside_group` |
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
