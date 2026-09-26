# Simple hold to dim

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes". Builds on `docs/specs/simple-channel-types.md`.

**Status:** approved (2026-09-25)

## 1. What and why

On a **push button**, the user can set **Hold** to **Dim**. Holding the button ramps the channel's target brightness smoothly; releasing it stops the ramp and leaves the light where it is. Each hold goes the other way from the last one, like a one-button Hue dimmer. Only push buttons (BOOT included) have it: a toggle switch's lever stays put, so it has no hold.

## 2. Contract change

### 2.1 New action `dim`: additive

| Recipe field | Value |
| --- | --- |
| `event` | `hold` only, on a `momentary` channel |
| `action` | `dim` (new) |
| `target` | `{ rtype: light \| grouped_light, rid }` inside the channel's group, like `toggle` |

```json
{ "channelId": "d1", "event": "hold", "action": "dim", "target": { "rtype": "grouped_light", "rid": "…" } }
```

No new config fields and no new endpoints. `double_click` cannot be `dim`, because there is nothing to release.

### 2.2 Human API: additive

`PUT /api/switches/{mac}/channels`: `hold` accepts `{ "action": "dim", "target": … }`. The target must be in the group, same rule as the other hold actions. `double` with `dim` → `400 channel_kind_not_allowed`. `simple_channels.hold` already stores JSON, so the schema does not change.

### 2.3 Firmware behavior (Simple ≥ 0.4.0)

Clip v2 `dimming_delta` does the ramp on the Bridge, so the switch sends two commands per gesture and nothing while the button is held. LAN lag delays the start and the stop by about the same amount, so the light stops close to where the user let go.

At the hold threshold (~800 ms, same as today):

1. `GET` the target (`on`, `dimming.brightness`). This is the only read in the gesture.
2. Pick the direction:
   - Target off → `PUT { "on": { "on": true }, "dimming": { "brightness": <min> } }`, then ramp **up**.
   - Brightness ≥ 95 % → **down**. Brightness ≤ 5 % → **up**.
   - Otherwise → the opposite of this channel's last ramp (RAM; **up** after boot).
3. Start: `PUT { "dimming_delta": { "action": "up" | "down", "brightness_delta": 100 }, "dynamics": { "duration": <full sweep ms> } }`.

On release: `PUT { "dimming_delta": { "action": "stop" } }`.

Rules:

- Ramping **down** stops at the lamp's minimum; it never turns the light off. Off stays a click (`toggle`).
- If the `GET` fails, ramp in the opposite direction from the last ramp without turning the light on first. If the start `PUT` fails, log it and ignore the release. If the stop `PUT` fails, the ramp finishes on its own (full up, or down to the minimum). That is acceptable: log it, and do not retry.
- A release before the start `PUT` returns still sends `stop` once the start has gone out.
- `dim` does not clear the channel's last scene. Only `off` does (Round §8.1 rule).
- BOOT with a `dim` hold never re-pairs from the button (same rule as any `hold` recipe, `simple-channel-types.md` §2.4).

## 3. Compatibility

- **Console with a board that has not updated (Simple 0.3.x):** 0.3.x drops recipes with an unknown `action` and keeps the rest (`recipeFromObject` rejects it and `recipesParseOne` skips it). A `dim` hold is therefore no recipe at all: on D0–D2 hold does nothing, and on BOOT the 3 s press still re-pairs. Nothing else on the channel breaks. The console still only offers **Dim** to boards on ≥ 0.4.0. On older boards the option is shown disabled with "Needs firmware 0.4.0", so nobody sets a hold that silently does nothing.
- **Board with a console that has not deployed:** 0.4.0 simply never receives `dim`.
- Firmware versions that need the old path: none. This change is additive.
- Old path removal: nothing to remove.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] `SimpleGesture` gets `{ action: "dim", target }`. Validation: only on `hold`, target in the group.
- [ ] Hold selector: **Dim** option, disabled below firmware 0.4.0. Confirmation reads *"hold → dim all of Living"*.
- [ ] `docs/device-api.md` and `docs/definitions.md` updated in the same commit.
- [ ] `docs/changelog.md` entry.
- [ ] Deployed; checked on production.

### Round (`hue-round-switch`)

No change.

### Simple (`hue-simple-switch`)

- [ ] `recipeActionOk` accepts `dim` (hold only).
- [ ] Hold with `dim`: GET, direction, start `dimming_delta`, then `stop` on release, per §2.3.
- [ ] Per-channel last direction in RAM.
- [ ] `FIRMWARE_VERSION` → `0.4.0`.
- [ ] `CHANGELOG.md` entry (user-facing wording).
- [ ] Release uploaded; `/firmware/simple/manifest.json` shows 0.4.0.
- [ ] Tested on a board by the user: hold up, release, hold down; hold from off; release at a mid level stops there; whole room and one light.

### Cleanup

Nothing.

## 5. Open questions

- **Full sweep time** (`dynamics.duration` for 0 → 100 %): proposed **5 s**. Shorter is faster but harder to stop where you want.
- **Minimum when starting from off:** proposed 1 % (the Hue minimum).
- **Direction rule:** alternate every hold, with the ≥ 95 % / ≤ 5 % overrides. The other option is "always up, unless ≥ 95 %".
- **Verify on the Bridge Pro during implementation:** `stop` halts the transition at once; `dimming_delta` works on `grouped_light`; a room with mixed lamp models ramps evenly enough.
