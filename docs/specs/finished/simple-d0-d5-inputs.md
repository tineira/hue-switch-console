# Simple: inputs on D0–D5

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** done (2026-09-28). Console live since `4f5d626`; Simple 0.5.0 released (`a05be36`) with one NVS blob per channel (§5 Q2); checked on a board by the user.

## 1. What and why

A Simple switch today offers four inputs: the BOOT button and D0, D1 and D2. After this change it offers seven: BOOT plus D0–D5. In the console, each one can be set up as a toggle switch or a push button, or left unused, exactly like D0–D2 today. One board can then drive up to six wall switches or buttons, plus BOOT.

D3–D5 are GPIO 21, 22 and 23. None of them is a strapping pin, and the firmware uses none of them for anything else: it has no I2C, even though D4/D5 are the board's usual I2C pins. D6–D10 stay unused. D6 is the chip's serial TX at boot, and six switches is enough for a wall plate.

## 2. Contract change

The payload shapes do not change. `channels[]` on register is already "the pins the board has", and `PUT /api/switches/{mac}/channels` already accepts any channel the switch registered (`invalid_channel` otherwise). What changes is the data a Simple board sends, and the docs that describe it.

**`POST /api/device/register`: additive (data only).** Simple firmware ≥ 0.5.0 registers seven channels, in this order:

| `id` | `gpio` | `label` |
| --- | --- | --- |
| `boot` | 9 | BOOT |
| `d0` | 0 | D0 |
| `d1` | 1 | D1 |
| `d2` | 2 | D2 |
| `d3` | 21 | D3 |
| `d4` | 22 | D4 |
| `d5` | 23 | D5 |

Older Simple firmware keeps sending `boot`, `d0`–`d2`.

**`docs/device-api.md` edits:**

- Under the register `channels` row: "Simple firmware ≥ 0.5.0 sends `boot` and `d0`–`d5` (seven channels); older Simple firmware sends `boot`, `d0`–`d2`." Keep the four-channel example as it is.
- `GET /api/device/config`: "A Simple switch runs at most 7 channels and 21 recipes (3 per channel)." These are the firmware's limits after this change. The console never builds more than that, because each channel derives at most 3 recipes.

No new endpoints, fields, error codes or NVS keys written over USB.

## 3. Compatibility

- **Console with a board that has not updated:** it registers four channels, and the console shows four rows as today. Nothing changes.
- **Board with a console that has not deployed:** safe. The current console stores any channel list and validates `PUT /channels` against it. Only the copy ("up to three switches") and the empty-state text are stale. Console first is still the order.
- **Updating a board:** the next register replaces `switches.channels` with seven entries. The console keeps existing `simple_channels` rows (it wipes them only when the bridge or product changes), so D0–D2 settings survive. D3–D5 show as "Set up".
- **Downgrading a board:** firmware < 0.5.0 ignores the channel ids it does not have. Settings on D3–D5 stay in the console but do nothing until the board is updated again.
- **Old path:** there is none to remove. Four-channel boards remain valid.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] `docs/device-api.md` updated as in §2
- [x] Empty-state text in `app/switches/simple-channels-editor.tsx` ("so BOOT / D0 / D1 / D2 appear") names BOOT / D0–D5
- Landing page (`app/page.tsx`, `app/landing/parts-drawings.tsx`): out of scope. It is being redesigned; the redesign should say up to six switches on D0–D5.
- [x] How-to (`lib/how-to.ts`) and `docs/definitions.md`: wherever they name the Simple pins, list D0–D5
- [x] Deployed; checked on production with a seven-channel board. No four-channel board was checked after the deploy; the console change is docs and copy only, so the four-channel path is unchanged.

### Round (`hue-round-switch`)

- [x] No change

### Simple (`hue-simple-switch`)

- [x] `kChannels[]` in `channels.h` lists `boot` and `d0`–`d5` with the GPIOs in §2
- [x] Default kind when the config has no `channels[]` (old payload): `d0`–`d2` keep `maintained`, and `d3`–`d5` are `CHK_NONE`, so unwired pins never act
- [x] `recipes.h`: `kMaxRecipes` 16 → 21. `kMaxChannelSettings` is already 8 (≥ 7).
- [x] NVS headroom: confirm on a board that a worst-case config saves twice in a row (§5 Q2). Log `nvs_get_stats` in debug builds before and after. Passed after the per-channel storage change (§5 Q2).
- [x] README pin table and wiring doc list D0–D5
- [x] `FIRMWARE_VERSION` → 0.5.0; `CHANGELOG.md` entry (user-facing, e.g. "You can now wire up to six switches or buttons to one board, on pins D0 to D5.")
- [x] Release uploaded; `/firmware/simple/manifest.json` shows 0.5.0
- [x] Tested on a board by the user: each of D3–D5 as a toggle switch and as a push button; D0–D2 settings survive the update

## 5. Open questions

1. ~~Landing drawing~~ Decided: out of scope, the landing page is being redesigned.
2. ~~NVS headroom~~ **Resolved: measured on a board, and the fix shipped in 0.5.0.** Board: XIAO C6, debug build, 20 KB `nvs` partition, 630 entries in total, 504 usable.
   - Everything outside the `recipes` namespace takes ~165 entries, not the ~100 estimated.
   - **Single-blob layout (first cut of 0.5.0): the check failed.** The worst case (21 recipes) is a 6,095-byte blob. The `recipes` namespace took 198 entries, leaving 363 used and 141 available after the save. That save fit by only ~1–3 entries. A second worst-case save would need ~195 entries with 141 free, so it would fail.
   - **Fix shipped in 0.5.0**, the fallback this question described: one blob per channel (`c_<id>`) plus a `channels` key. `rev` is removed before the first changed write and written last, and unchanged channel blobs are skipped. On first boot the firmware migrates the old `jsonb`: it parses it into RAM, erases it, then writes the per-channel blobs.
   - **Measured after the fix.** Migrating the stored worst case went from 363 to 386 used entries (221 in the namespace). A worst-case save that changed one channel went from 385 to 386 used, with 118 available. The peak is the stored config plus one channel (~31 entries). With all seven scene cursors written, the steady state is ~407 of 504. The `nvs` partition is unchanged, so no USB reflash is needed and OTA stays possible (`docs/specs/ota.md`).
