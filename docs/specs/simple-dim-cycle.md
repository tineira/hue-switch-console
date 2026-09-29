# Simple dim cycle

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes". Replaces the ramp rules in `docs/specs/finished/simple-hold-dim.md` §2.3. The recipe, the target and the release `stop` stay the same.

**Status:** approved

## 1. What and why

Today a push button's **Hold → Dim** ramps one way per hold, always over 5 s, and each hold goes the other way from the last one. That has two problems:

- **It is slow near the ends.** The switch always sends `brightness_delta: 100` with `duration: 5000`. The Bridge clamps the target at 100 % (or the minimum) but still spreads the change over 5 s, so a light at 70 % takes 5 s to cover the last 30 %.
- **The switch has to guess the direction.** If it guesses wrong, the user has to let go and hold again.

After this change, holding the button runs a **cycle**: the light goes down to the minimum (or up to full, if it is below 30 % or off), pauses briefly, turns around, pauses at the other end, and so on until the user lets go. Each leg is timed from the distance left, so the speed is the same everywhere: a full sweep takes 3 s, and a light at 70 % reaches full in about 0.9 s. A wrong first direction costs one leg; the user just keeps holding.

## 2. Contract change

### 2.1 Recipe and APIs: none

`{ "event": "hold", "action": "dim", "target": … }` is unchanged. No new fields, no new endpoints, no console code change. Only the firmware's behavior and the docs that describe it change.

### 2.2 Firmware behavior (Simple ≥ 0.7.0)

Constants (firmware, tunable after testing on the wall):

| Constant | Value | Meaning |
| --- | --- | --- |
| `kDimSweepMs` | 3000 | Full sweep, minimum → 100 % |
| `kDimDwellMs` | 400 | Pause at each end before turning around |
| `kDimMaxHoldMs` | 30000 | Hold time after which the cycle stops by itself |
| `kDimMinBrightness` | 1 | Level when the target starts off (unchanged) |
| `kDimUpBelow` | 30 | Below this brightness (%), the first leg goes up |

At the hold threshold (~800 ms, unchanged):

1. `GET` the target (`on`, `dimming.brightness`). This is the only read in the gesture.
2. Pick the first direction:
   - Target off → `PUT { "on": { "on": true }, "dimming": { "brightness": 1 } }`, brightness is now 1, go **up**.
   - Brightness < `kDimUpBelow` (30 %) → **up**. A light that low is most likely meant to get brighter.
   - Otherwise → **down**.
   - `GET` failed → **down**, with brightness unknown (treat the first leg as a full sweep).
3. Start the leg: `PUT { "dimming_delta": { "action": "up" | "down", "brightness_delta": 100 }, "dynamics": { "duration": <leg ms> } }`, where
   `leg ms = kDimSweepMs × distance / 100`, and `distance` is `100 − brightness` going up or `brightness − 1` going down, never less than 150 ms.
4. When `leg ms + kDimDwellMs` has passed since the leg started, and the button is still held, start the next leg the other way with the full `kDimSweepMs`. Repeat.
5. On release: `PUT { "dimming_delta": { "action": "stop" } }`, and cancel any pending turn-around. A release during a dwell still sends `stop`; it does nothing on the Bridge but costs nothing.
6. After `kDimMaxHoldMs` of continuous hold, send `stop` and ignore the rest of the hold (a stuck button or a noisy pin must not cycle forever).

The switch keeps its own estimate of where the light is. It does not `GET` again between legs. LAN lag can make a leg turn around a little early or late; the dwell absorbs it, and a late turn-around only makes the light sit at the end a bit longer.

Unchanged rules from `simple-hold-dim.md` §2.3:

- The cycle never turns the light off. Down stops at the lamp's minimum. Off stays a click.
- If a start or turn-around `PUT` fails, log it and stop the cycle (no more legs); still send `stop` on release. If `stop` fails, the current leg ends on its own at full or at the minimum. Do not retry.
- A release before the first start `PUT` returns still sends `stop` once the start has gone out.
- `dim` does not clear the channel's last scene.
- BOOT with a `dim` hold never re-pairs from the button.

Removed: the per-channel "last direction" in RAM. Every hold starts by the rule in step 2, so the button behaves the same every time.

Rate: one command every 3.4 s at most while held, well under the Bridge's limit for `grouped_light` (about 1 per second).

### 2.3 Docs

- `docs/definitions.md`, the `dim` row of the action table: describe the cycle (up first below 30 % or from off, down otherwise, 3 s sweep, pause at the ends, `stop` on release) and point to this spec.
- `docs/device-api.md`, the paragraph on a push button's `hold`: "ramp the target up and down in a cycle while held, `stop` on release" instead of "alternating up and down", and point to this spec.

## 3. Compatibility

- **Console with a board that has not updated (Simple 0.4.0–0.6.x):** the recipe is the same, so the board keeps the old one-way 5 s ramp. Nothing breaks. The docs describe both until no registered Simple reports < 0.7.0.
- **Board with a console that has not deployed:** no console change is needed; 0.7.0 works with today's console.
- Firmware versions that need the old path: none on the console side. The docs mention `simple < 0.7.0` behaves the old way.
- Old path removal: drop the "before 0.7.0" note from the docs once no switch reports an older `firmware` (user's OK).

## 4. Checklist

### Console (`hue-switch-console`)

- [x] No code change. `docs/definitions.md` and `docs/device-api.md` updated per §2.3, noting that Simple < 0.7.0 ramps one way.
- [ ] No console changelog entry (the change reaches `/changelog` through the Simple firmware notes).

### Round (`hue-round-switch`)

No change.

### Simple (`hue-simple-switch`)

- [ ] `kDimSweepMs` → 3000; add `kDimDwellMs`, `kDimMaxHoldMs`, `kDimUpBelow`.
- [ ] `channelDimStart`: first direction per §2.2 step 2; leg duration from the distance (`hueDimStart` takes the duration).
- [ ] Turn-around legs scheduled while held, without blocking other channels or the Hue worker; cancelled on release.
- [ ] 30 s cap.
- [ ] Remove `DimRuntime.lastUp`.
- [ ] `FIRMWARE_VERSION` → `0.7.0`.
- [ ] `CHANGELOG.md` entry (user-facing wording, e.g. "Hold to dim now goes down and up in a loop until you let go, and moves at the same speed from any level").
- [ ] Release uploaded; `/firmware/simple/manifest.json` shows 0.7.0.
- [ ] Tested on a board by the user: hold at 70 % (goes down, then up, then down); release mid-leg stops there; release during the pause at full stays at full; hold from off (turns on at 1 %, goes up); hold at 20 % (goes up first); hold at 40 % (goes down first); whole room and one light; a hold longer than 30 s stops by itself.

### Cleanup

- [ ] Drop the "Simple < 0.7.0" note from the docs (user OK, no switch on an older `firmware`).

## 5. Open questions

- **Full sweep time:** **3 s**, approved with the spec. 2 s is faster but harder to stop at low levels. Tune on the wall.
- **Pause at the ends:** **400 ms**, approved with the spec. Long enough to see "it reached full" and let go there.
- **First direction:** decided by the user: **up below 30 %** (and from off), **down** otherwise, dropping the alternation between holds. Cost: from 25 % to the minimum takes one full leg up and back (about 5.7 s). The threshold is a constant and can be tuned on the wall.
- **Cap:** **30 s** of continuous hold, approved with the spec.
- **Verify on the Bridge during implementation:** a `dimming_delta` sent while another is running replaces it cleanly (no jump); a room with mixed lamp models reaches the ends close enough together that the pause hides the difference.
