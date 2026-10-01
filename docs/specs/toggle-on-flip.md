# Toggle switch: each flip toggles

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** approved

## 1. What and why

Today a Simple **Toggle switch** input copies the lever to Hue: closed sends `on`, open sends `off`. When the lights change from somewhere else (the Hue app, a schedule, another switch), the lever and the lights disagree. The lever then reads "on" while the lights are off, the user flips it expecting light, and the switch sends `off` to lights that are already off. Nothing visible happens, so the switch feels broken. This is also why two switches can't share one light (a staircase or hallway pair): each lever claims its own position, so they disagree all the time. The build guide says such pairs aren't supported yet.

After this change, each Toggle switch input has a **Flip** setting:

- **Each flip toggles the lights** (new, the default for new inputs). Any change of lever position toggles the target, whichever way the lever moves. The lever position means nothing, so it can never disagree with the lights. Two boards, one in each switch housing of a staircase pair, both set to the same room, just work.
- **The lever sets on or off** (today's behavior). Closed = on, open = off.

In toggle mode a quick flick and back is a double-click from **either** lever position, so the scene list keeps working. Recalling a scene turns the lights on, so it doesn't matter where the lever ends up.

Same idea as the Hue Wall Switch Module's rocker mode, where every flip toggles.

## 2. Contract change

### 2.1 Channel setting: `flip` (additive)

`PUT /api/switches/{mac}/channels`, its response and `GET …/channels` gain an optional field on each channel:

| Field | Values | Default | Rules |
| --- | --- | --- | --- |
| `flip` | `"set"` \| `"toggle"` | `"set"` when absent | Only on a `maintained` channel; a `momentary` channel with `flip` → `400 channel_kind_not_allowed` |

A body without `flip` keeps the stored value (same rule as `label`), so a page opened before this field existed cannot reset it.

### 2.2 Recipes the console derives

```text
maintained, flip set:    on → on target · off → off target · double_click → recall_scene scenes[] (if any)
maintained, flip toggle: on → toggle target · off → toggle target · double_click → recall_scene scenes[] (if any)
momentary:               unchanged
```

### 2.3 Config poll (`GET /api/device/config`) (additive)

A `maintained` channel in toggle mode carries `"flip": "toggle"` in `channels[]`. A channel in set mode leaves the field out, so the payload for every existing switch is byte-for-byte what it is today.

```json
{ "id": "d0", "kind": "maintained", "flip": "toggle", "group": { … } }
```

No USB or NVS key change: `channels[]` arrives with the config poll and the firmware already stores the whole payload.

### 2.4 Firmware behavior (Simple ≥ 0.8.0, toggle mode only)

Set mode stays exactly as it is in `docs/definitions.md` → "What the firmware must do (Simple)".

Edges are debounced as today (~50 ms). Call each debounced change of position a **flip**.

1. **No `double_click` recipe:** each flip posts its event at once, in both directions (closed → `on`, open → `off`). No 400 ms window.
2. **With a `double_click` recipe:** a flip starts the window (~400 ms, same constant as today) in either direction. A second flip inside the window (the lever is back where it started) posts `double_click` and closes the window. If the window expires, the first flip posts its event (`on` or `off`). This is the push button's click / double-click logic, run on lever edges.
3. **No fallback.** There is no `double_click` → `on` fallback in toggle mode: the quick flick only exists as a double-click when a recipe exists (rule 1 otherwise sends two toggles).
4. **Queue.** Toggle events are never merged or dropped for "the lever wins": each one is queued in order on its channel, like push-button gestures, and expires after `kHueJobStaleMs` (10 s) waiting for the Bridge. A toggle that runs late would surprise the user; dropping it is better.
5. **Scene cycle.** A toggle that turned the target **off** (the firmware knows from its `GET`) restarts the channel's scene cycle, like `off` in set mode. A toggle that turned it on, or failed, leaves the cycle alone.
6. **No action at startup.** Boot, a reconnect, a config change, or a change of `kind` or `flip` reads the pin and starts from that position without posting anything. (The firmware already primes this way at boot and on a `kind` change; a `flip` change must do the same.) Hue bulbs come back **on** after a power cut, so a toggle at boot would turn them off.

The Hue call is the existing `toggle` action: `GET on` + inverse `PUT`. On a `grouped_light`, `on` is true when any light in the group is on, so a half-lit room turns off on the first flip.

Two boards on one target (staircase): flipped at the same moment, both may read the same state and set the same result. That needs two people flipping within ~100 ms; accepted.

### 2.5 `docs/device-api.md` and `docs/definitions.md`

- `device-api.md`: `flip` in the `PUT …/channels` example, field notes and validation table; `flip` in the config poll example and notes; the derived-recipes bullet.
- `definitions.md`: "Events read (`maintained` channel)" gets the toggle mode; "Simple channel settings → recipes" gets the second `maintained` line; the firmware section gets §2.4.

## 3. Compatibility

There is one user today, so the console carries **no** old-firmware path: no version gate, no disabled state, no cleanup step. Update every Simple to 0.8.0 before setting an input to toggle.

- **Console with a board that has not updated (Simple < 0.8.0):** the board runs the `on → toggle` / `off → toggle` recipes (0.7.1 already accepts `toggle` on any event), but badly: two quick flips can merge into one toggle, every lever-off flip waits 400 ms, and the double-click only works from the on position. Not handled; update the board.
- **Board on 0.8.0 with a console that has not deployed:** it never sees `flip`, so every channel is in set mode, exactly as today. Firmware can ship first.
- **Existing channels:** stored as `set`, unchanged until the user picks toggle.
- **Firmware versions that need the old path:** none.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] DB: `simple_channels.flip text not null default 'set' check (flip in ('set', 'toggle'))` (schema version bump)
- [ ] Types, parse and validation (`lib/simple-channels.ts`, `lib/parse.ts`, `lib/types.ts`): `flip` on `maintained` only; keep the stored value when absent
- [ ] Recipe derivation: `on`/`off` → `toggle` in toggle mode; `flip: "toggle"` in the config poll's `channels[]`
- [ ] Editor (`app/switches/simple-channels-editor.tsx`): Flip row on the Toggle switch card, "Each flip toggles the lights" / "The lever sets on or off"; a new Toggle switch input defaults to toggle
- [ ] Gesture and Lights labels (`lib/gestures.ts`, `lib/lights-map.ts`): a toggle-mode lever reads "Toggles <target>"
- [ ] Build guide (`lib/how-to-build.ts`): replace "Two switches for one lamp … aren't supported yet" with how to do it: one board in each switch housing, both inputs Toggle switch, Flip = toggles, same room or zone. An old 3-way switch is wired as a plain contact: common terminal plus one other
- [ ] How-to guide copy for Toggle switch mentions the Flip choice
- [ ] `docs/device-api.md` and `docs/definitions.md` updated in the same commit as the API change
- [ ] `docs/changelog.md` entry
- [ ] Deployed; checked on production

### Round (`hue-round-switch`)

Not affected.

### Simple (`hue-simple-switch`)

- [ ] Parse `flip` in `channels[]` (`recipes.h`); unknown values = set
- [ ] Toggle-mode state machine (`channels.h`): §2.4 rules 1–3 and 6 (prime on a `flip` change)
- [ ] Worker queue (`hue_worker.h`): §2.4 rules 4–5 for toggle-mode channels
- [ ] Host tests for the state machine and the queue rules
- [ ] `FIRMWARE_VERSION` 0.8.0
- [ ] `CHANGELOG.md` entry (user-facing wording)
- [ ] Release uploaded; `/firmware/simple/manifest.json` shows 0.8.0
- [ ] Tested on a board by the user: single flips both ways, quick flick both ways with and without scenes, two boards on one room, power cycle with lights on

## 5. Decisions

1. **Name of the setting:** "Flip", with "Each flip toggles the lights" / "The lever sets on or off". It describes what the user does, not the wiring.
2. **Explicit `flip` field**, not inferred from the recipes (toggle mode when `on` and `off` are both `toggle`). The state machine changes, and an explicit setting is easier to read in logs and to extend.
3. **A quick flick with no double-click recipe toggles twice** (the light blinks off and on) instead of doing nothing. It's what the user did, and it avoids a wait on every flip.
4. **No old-firmware path in the console** while there is one user (§3).
