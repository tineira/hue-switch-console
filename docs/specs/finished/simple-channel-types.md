# Simple channel types

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** done

## 1. What and why

Today each Simple channel gets up to three free recipes (`on`, `off`, `double_click`), each with its own target, and the firmware decides whether a pin is a wall switch or a push button. Afterwards the Simple works like a Round page. For each channel the user picks, in order:

1. A **group**: one room or zone from the Bridge.
2. A **type**: **Toggle switch** (a lever that stays closed or open) or **Push button** (press and release). The same wiring (contact to GND) supports both, so the type is the user's choice, not the firmware's.
3. A **target**: the whole group (`grouped_light`) or one child light.
4. The gestures, whose slots depend on the type:

| Type | Gesture | What it does | User choice |
| --- | --- | --- | --- |
| Toggle switch | lever closes | `on` the target | automatic |
| Toggle switch | lever opens | `off` the target | automatic |
| Toggle switch | double-click | cycle a scene list from the group | the list (1–8 scenes), or empty |
| Push button | click | `toggle` the target | automatic |
| Push button | double-click | cycle a scene list (§2.7) | the list (1–8 scenes), or nothing |
| Push button | hold | dim, or turn off the whole group (§2.7) | Dim, Turn off all, or nothing; on BOOT, nothing = re-pair (§2.4) |

The goal is a channel you configure in one pass, not three free slots, and odd mixes (on → one lamp, off → another room) can no longer be saved.

## 2. Contract change

### 2.1 Register (`POST /api/device/register`): additive

- `channels[].kind` becomes **optional**. Firmware ≥ `simple 0.3.0` omits it. The console ignores it when present (old boards); the type is no longer declared by the device.
- `channels[]` still lists the pins (`id`, `gpio`, `label`). The UI still does not invent pins.

### 2.2 Config (`GET /api/device/config`): breaking for Simple

The Simple payload gains `product` and `channels[]`, shaped like Round's `pages[]`:

```json
{
  "rev": 20,
  "product": "simple",
  "channels": [
    {
      "id": "d0",
      "kind": "maintained",
      "group": { "rtype": "room", "rid": "…", "groupedLightRid": "…" }
    },
    {
      "id": "boot",
      "kind": "momentary",
      "group": { "rtype": "zone", "rid": "…", "groupedLightRid": "…" }
    }
  ],
  "recipes": [
    { "channelId": "d0", "event": "on",  "action": "on",  "target": { "rtype": "grouped_light", "rid": "…" } },
    { "channelId": "d0", "event": "off", "action": "off", "target": { "rtype": "grouped_light", "rid": "…" } },
    {
      "channelId": "d0",
      "event": "double_click",
      "action": "recall_scene",
      "targets": [
        { "rtype": "scene", "rid": "…", "name": "Relax" },
        { "rtype": "scene", "rid": "…", "name": "Bright" }
      ]
    },
    { "channelId": "boot", "event": "short", "action": "toggle", "target": { "rtype": "light", "rid": "…" } }
  ]
}
```

- `channels[].kind`: `maintained` (UI: *Toggle switch*) or `momentary` (UI: *Push button*). Same words as before; only the owner changed.
- A channel that is not configured is **absent** from `channels[]` and has no recipes. Firmware ignores that pin.
- The console **derives** the recipes from the channel. The firmware stays a generic "event → recipe" runner and does not need to know that `on` was automatic.
- `recall_scene` with a list uses `targets[]` (1–8, the Round shape). A single scene is a list of one.
- New event `hold` (momentary only). `double_click` is now valid on momentary as well as maintained.

| Recipe field | Values |
| --- | --- |
| `event` | maintained: `on` \| `off` \| `double_click`. momentary: `short` \| `double_click` \| `hold` |
| `action` | `on` \| `off` \| `recall_scene` \| `toggle` |
| `target` / `targets[]` | `target` for `light` / `grouped_light`; `targets[]` for a scene list |

The console sends `on`, `off` and `double_click` (scene list) on maintained, and `short`, `double_click` and `hold` on momentary (§2.6). The firmware accepts any combination in the table.

### 2.3 Firmware behavior (Simple ≥ 0.3.0)

**Maintained channel.** This is the current state machine, unchanged: closed → open starts a window (~400 ms, §5); if it closes inside the window the event is `double_click`, if the window expires open it is `off`, and open → closed with no pending window is `on`. Without a `double_click` recipe it still runs `on`.

**Momentary channel:**

- Press and release shorter than the hold threshold (~800 ms, §5):
  - With a `double_click` recipe on that channel, wait the window. A second press inside it is `double_click` (it fires on the second press), and if the window expires the event is `short`.
  - With **no** `double_click` recipe, `short` fires **on release, immediately**. There is no double-click wait.
- A press held past the threshold fires `hold` once while still pressed. The release does nothing.

**Scene list (any event with `targets[]`).** Same rules as Round §8.1: cycle from the last scene `rid` this channel set (NVS), wrap, and start at the first when there is none. An `off` event on the same channel clears that `rid`, so the next scene cycle starts at the first scene. Skip scenes that return 404. Do not GET `status.active`.

### 2.4 BOOT

- BOOT is always `momentary`. The console does not offer Toggle switch for it.
- Click (`short`) is configurable like any push button.
- Hold is a per-channel choice in the console: **Re-pair with Bridge** (default) or a Hue action.
  - Re-pair means **no `hold` recipe** for `boot`. Firmware keeps today's 3 s long press → re-pair.
  - With a `hold` recipe for `boot`, the firmware runs it at the hold threshold and **never** re-pairs from the button. Re-pair is then only possible by USB (`/install`). The console says so next to the option.

### 2.5 Human API: breaking

`PUT /api/switches/{mac}/recipes` is replaced by a channel-level body. The console derives recipes from it:

```json
{
  "channels": [
    {
      "id": "d0",
      "kind": "maintained",
      "group": { "rtype": "room", "rid": "…" },
      "target": { "rtype": "grouped_light", "rid": "…" },
      "scenes": ["…", "…"]
    },
    {
      "id": "boot",
      "kind": "momentary",
      "group": { "rtype": "zone", "rid": "…" },
      "target": { "rtype": "light", "rid": "…" },
      "double": null,
      "hold": null
    }
  ]
}
```

Validation:

- `id` is a channel the switch registered.
- `boot` is `momentary`.
- `group` is a room or zone in the snapshot.
- `target` is that group's `grouped_light` or one of its `light_ids`.
- `scenes` holds 0–8 scenes whose `group_rid` is the group, on `maintained` only.
- `double` and `hold` are `null` or `{ action, target | targets }` inside the group, on `momentary` only (§2.6). On `boot`, `hold: null` means re-pair.

Errors: `400 invalid_channel`, `400 target_outside_group`, `400 scene_outside_group`, `400 channel_kind_not_allowed`.

### 2.6 Push-button double-click and hold (amended 2026-09-25)

The first draft reserved push-button double-click and hold, and only BOOT's hold was configurable. The user clarified that **every** push button, BOOT included, has click, double-click and hold:

- Click: `toggle` the channel's target (automatic, as before).
- Double-click and hold: each is **nothing** or one of Toggle, Turn on, Turn off (a target in the group, defaulting to the channel's target) or Cycle scenes (1–8 scenes from the group).
- BOOT hold set to nothing keeps the 3 s re-pair (§2.4). On D0–D2, nothing means nothing.
- Switching a channel from toggle switch to push button moves its scene list to the push-button double-click, and back.

Console only: firmware 0.3.0 already handles `double_click` and `hold` on every momentary channel (§2.3). Storage adds `simple_channels.double_click`; the PUT body adds `double`.

### 2.7 Push-button gestures narrowed (amended 2026-09-26)

Click always toggles the target, so double-click and hold only offer what a click cannot do:

| Gesture | Choices | Why the others are gone |
| --- | --- | --- |
| Double-click | nothing, **Cycle scenes** | Toggle / Turn on repeat the click. A double-click also delays every single click (~400 ms), so it should earn that. Same meaning as a toggle switch's double-click. |
| Hold | nothing (BOOT: re-pair), **Dim** (`docs/specs/finished/simple-hold-dim.md`), **Turn off** the whole room or zone | Cycling scenes by holding is awkward. Turn off only helps when the click controls less than the group, so it is offered only when the channel's target is one light, and always targets the group's `grouped_light`. Changing the click target to the whole group clears it. |

Console only: the console offers and accepts fewer combinations; the firmware contract is unchanged. No saved channel used a removed choice when this shipped.

## 3. Compatibility

The user approved an exception to "never ship a console that breaks boards already on the wall": there are few Simples, and the user reflashes them by USB.

- **Existing recipes are deleted.** The console deploy drops every Simple recipe and bumps `rev` on every Simple. Channels are configured again in the new UI.
- **Console with a board that has not updated (`simple < 0.3.0`):** config returns `{ rev, recipes: [] }`. The switch does nothing on the wall until it is reflashed. The UI shows the channels read-only with "Update firmware to configure this switch" and a link to `/install`.
- **Board with a console that has not deployed:** firmware ≥ 0.3.0 must accept the **old** payload (no `product`, no `channels[]`, single `target`). It then uses its compiled defaults (`boot` momentary, `d0`–`d2` maintained) and runs the old recipes as today.
- **Recommended order (minimizes dead time):** ship Simple 0.3.0 first. It works against the current console, so reflash every Simple. Then deploy the console, and each switch picks up an empty config and gets configured. This inverts "console first", on purpose, because the console side is the breaking one.
- Firmware versions that need the old path: none after the console deploys (no dual path).
- Old path removal: part of the console deploy. The firmware's old-payload fallback can go in a later Simple release, once the console has deployed.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Schema: per-channel settings in their own table (`simple_channels`: kind, group, target, scenes, hold), so a register does not overwrite them. Simple recipes are derived from it at poll time, so `recipes` keeps Round only and its `event` check needs no `hold`.
- [x] Migration: delete Simple recipes, bump `rev` on every Simple.
- [x] `PUT /api/switches/{mac}/channels` takes the §2.5 body and validates it; `/recipes` returns `410 gone`.
- [x] `GET /api/device/config`: Simple payload per §2.2. `recipes: []` for `firmware < 0.3.0`.
- [x] Register: `channels[].kind` optional and ignored.
- [x] UI per channel: group → type → target → scene list (maintained) or BOOT hold choice. Show a confirmation sentence, e.g. *"D0 · Living · toggle switch: on/off whole room · double-click cycles Relax, Bright"*. Warn when the target is one light and scenes are set: "Scenes apply to the whole room". Show the read-only state for old firmware.
- [x] `docs/device-api.md` and `docs/definitions.md` (channel, events, assign flow, firmware rules) updated in the same commit.
- [x] `docs/changelog.md` entry.
- [x] §2.6: double-click and hold on every push button (`double` in the PUT body, `simple_channels.double_click`).
- [x] Deployed; checked on production.

### Round (`hue-round-switch`)

No change.

### Simple (`hue-simple-switch`)

- [x] Reads `channels[]` (`kind`, group) from config. Pins absent from it are ignored. The old payload falls back to compiled defaults.
- [x] Momentary state machine: `short` / `double_click` / `hold` per §2.3, with no double-click wait when there is no `double_click` recipe.
- [x] BOOT: `hold` recipe present → run it, no re-pair from the button. Absent → 3 s re-pair as today.
- [x] `recall_scene` with `targets[]`: per-channel last scene `rid` in NVS, cleared by `off`, skip 404, wrap.
- [x] Register omits `channels[].kind`.
- [x] `FIRMWARE_VERSION` → `0.3.0`.
- [x] `CHANGELOG.md` entry (user-facing wording).
- [x] Release uploaded; `/firmware/simple/manifest.json` shows 0.3.0.
- [x] Tested on a board by the user: toggle switch (on, off, double-click cycle), push button (instant click without a double; double-click and hold on D0–D2), BOOT hold both ways.

### Cleanup

- [ ] Simple firmware drops the old-payload fallback (after the console deploy). Tracked in https://github.com/tineira/hue-simple-switch/issues/28; do it with the next Simple change that ships a release.

## 5. Open questions

- Hold threshold on momentary channels: proposed ~800 ms. BOOT with a `hold` recipe uses the same threshold.
- Double-click window: ~400 ms today, tuned in firmware. Is the same value right for push buttons, or shorter (~300 ms) because a finger is faster than a lever?
- Should a toggle switch whose target is one light still allow a scene list, or should the UI hide it? Current decision: allow it, with a warning.
