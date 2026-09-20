# Device API

Contract for the XIAO firmware (`hue-simple-switch`) and `push-from-bridge`.
Postgres is the source of truth. There is no server-side `INGEST_TOKEN`.

## Host and TLS

```
CONSOLE_URL=https://hue.tineira.com
```

Dev: that URL and a console API key in `config.h`. Product install (flash + Wi-Fi + token from Chrome, no Arduino): `docs/web-setup.md` — requisitos, no implementado.

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

Human UI uses a Supabase Auth session (email + password). No public signup.
That session is **not** valid as a device Bearer token.

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

If the switch was already registered and `bridgeid` changes, stored recipes
for that MAC are deleted and `rev` is reset to `0`.

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
  "firmware": "0.1.0",
  "bridgeid": "C42996FFFECA6703",
  "bridge_ip": "192.168.100.12",
  "source": "xiao",
  "channels": [
    { "id": "boot", "gpio": 9, "label": "BOOT", "kind": "momentary" },
    { "id": "d0", "gpio": 0, "label": "D0", "kind": "maintained" },
    { "id": "d1", "gpio": 1, "label": "D1", "kind": "maintained" },
    { "id": "d2", "gpio": 2, "label": "D2", "kind": "maintained" }
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
| `lights` | yes | Array; may be empty. Each item needs `id`, `name`. `on`, `caps[]` optional |
| `rooms` | yes | Array; may be empty. `id`, `name` required. `grouped_light_id` is the room-wide target. `light_ids[]` are light resource ids in that room/zone. `rtype` is optional (`room` \| `zone`) |
| `scenes` | yes | Array; may be empty. `id`, `name` required. `group_rtype` / `group_rid` locate the scene under a room or zone |
| `channels` | yes when registering a GPIO board | `{ id, gpio, label, kind }`. `kind` is `maintained` or `momentary`. Empty array allowed. Round Display may send `[]` |
| `product` | no | `"round"` or `"simple"`. Inferred from empty/`c1` channels if omitted |
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
  "lights": 1,
  "rooms": 1,
  "scenes": 1
}
```

Without `mac`, `mac` and `rev` are omitted.

---

Round Display firmware may send `"product": "round"` and `channels: []`.
Placeholder `c1` (gpio 0) is still accepted and treated as round. Simple-switch
boards omit `product` or send `"simple"` with GPIO channels.

---

## `GET /api/device/config?mac={mac}`

Poll recipes. Does **not** return topology. Compare `rev` to NVS: if remote
`rev` is greater, **replace** the whole local recipe array. If local `rev` ≥
remote, do not write NVS.

### Request

```
GET /api/device/config?mac=aabbccddeeff HTTP/1.1
Host: hue.tineira.com
Authorization: Bearer hsw_…
```

`mac` is required (query). Same hex rules as register.

### Response `200`

```json
{
  "rev": 12,
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
      "target": { "rtype": "scene", "rid": "99999999-aaaa-bbbb-cccc-dddddddddddd" }
    }
  ]
}
```

Empty assignment: `{ "rev": 0, "recipes": [] }`.

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

Simple-switch firmware still receives `{ rev, recipes[] }` with `channelId` only.

Unknown MAC for this key’s account: `404`.

| Recipe field | Values |
| --- | --- |
| `event` | `on` \| `off` \| `double_click` (maintained) or `short` (momentary) |
| `action` | `on` \| `off` \| `recall_scene` \| `toggle` |
| `target.rtype` | `light` \| `grouped_light` \| `scene` |

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
| `GET` | `/api/switches/{mac}/recipes` | `{ mac, rev, channels, recipes, … }` |
| `PUT` | `/api/switches/{mac}/recipes` | replace GPIO recipes; increments `rev` |
| `GET` | `/api/switches/{mac}/pages` | round pages + recipes |
| `PUT` | `/api/switches/{mac}/pages` | replace pages, swipe axis, and page recipes; increments `rev` |

### `PUT /api/switches/{mac}/recipes`

```
PUT /api/switches/aabbccddeeff/recipes HTTP/1.1
Cookie: sb-…-auth-token=…
Content-Type: application/json
```

```json
{
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
      "target": { "rtype": "scene", "rid": "99999999-aaaa-bbbb-cccc-dddddddddddd" }
    }
  ]
}
```

Omitted slots stay empty (no-op on the switch). Validation: `channelId` must
exist on the switch; event must match `kind`; `recall_scene` only with
`rtype: scene` (any event: `on`, `off`, `double_click`, `short`); `on` / `off` /
`toggle` cannot target a scene; `rid` must exist in the latest snapshot for
that `bridgeid`.

Response:

```json
{ "ok": true, "mac": "aabbccddeeff", "rev": 13, "recipes": [ ] }
```

---

## Removed

`POST /api/ingest` and `GET /api/ingest` return `410 gone`. Use
`POST /api/device/register`.
