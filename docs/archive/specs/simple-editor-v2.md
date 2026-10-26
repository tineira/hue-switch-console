# Simple editor v2

Console-only spec. It changes no device endpoint, payload or NVS key, so the cross-repo order in `AGENTS.md` does not apply. It is written as a spec because it changes the product model's UI (`docs/definitions.md`, "How the user assigns") and adds a console-only column.

**Status:** done (2026-09-28). Live since `c8c83fc`, with follow-ups `148406a` ("Save changes"), `8dd30c4` ("Remove *name*") and `ba852d1` (Dim follows Click); checked on production with a Simple board by the user.

Mockup: [`simple-editor-v2/mockup.html`](simple-editor-v2/mockup.html). Open it in a browser. It is clickable, uses sample Hue data, and saves nothing.

## 1. What and why

Today the Simple editor on **Switches** is a list of seven accordion rows (BOOT, D0–D5), each labelled with its pin and GPIO number, most of them "Not used". Opening a row opens gesture cards inside it. The Round editor next to it shows a picture of the device, only the pages that exist, an "Add page" button, and one level of cards. The Simple editor started as a three-pin form and grew to seven rows without a redesign.

After this change, a Simple board is set up like a Round: the user sees a picture of the board, a list of the **switches** they wired (with names they choose), and one editor for the selected switch. Adding a switch asks what is wired, then which pin, then which room. Unused pins stop taking up space. BOOT, the button on the board, is pinned at the top of the list as a normal push button, because it is the first input anyone can use: most people test with it before wiring anything. Only its Hold differs, since Hold is what competes with re-pairing.

### Problems this fixes

1. Rows lead with hardware (`D3`, `GPIO 21`), not with what the user wired.
2. Four or five of seven rows are "Not used" on a typical board.
3. Two levels of accordions (channel row, then gesture card).
4. The type (toggle switch / push button) is asked after the room, but it is a fact about the wiring, and changing it rewrites the gestures (`withKind`).
5. "Toggle switch" (a kind) reads like the push button's *toggle* action.
6. BOOT is listed as if it were a wired pin, with its exceptions ("always a push button", "hold stops re-pairing") scattered across the row, and nothing suggests it is the easy way to test.
7. Firmware gates for 0.3.0 and 0.4.0 remain. Every registered Simple reports 0.5.0 (checked 2026-09-28: 3 boards, all `0.5.0`, all 7 channels).
8. Removing a channel means picking "Not used" in the room list.
9. Channels have no name; two switches in the same room read the same.

## 2. Contract change

None. `PUT /api/switches/{mac}/channels`, `GET /api/device/config` and register are unchanged. The device never sees the new name.

**Console-only data (additive):** `simple_channels.label text null` (max 40 characters, trimmed, empty → null). `PUT /api/switches/{mac}/channels` accepts an optional `label` per channel and returns it. The config poll ignores it. `docs/device-api.md` does not change because the field is on the browser endpoint, not a device endpoint; document it next to the endpoint's other browser fields if that doc lists them.

## 3. Design

Layout matches `RoundPagesEditor`: a left column (`bg-background`, flex `1 1 380px`, wider than Round's, §3.1) and a right column (flex `999 1 420px`) that stack on narrow screens.

### 3.1 Left column: board and switch list

- **Board picture.** The same XIAO line drawing as the landing page's Simple card: the user's Claude Design model ("XIAO ESP32-S3 Blueprint", project "Round Display Blueprint Model"), already in the console as `buildXiao()` in `app/landing/round-model.ts` and rendered once to a still image by `app/landing/simple-render.ts`. No live WebGL context stays open. Refactor `renderSimpleDrawing` so it returns the drawing plus the projected screen position of each pad (`PAD_Z` → D0–D5) and of BOOT, and let each caller draw its own overlay: the landing keeps its callouts, and the editor draws interactive pad markers from the same camera.
  - Overlay markers, three clearly different states:
    - **Selected** (the switch open in the editor, or the pin being picked in the add flow): solid accent dot inside a `--foreground` ring, a thicker `--foreground` leader, and the pin label as a `--foreground` pill with reversed text. Drawn last, so crowded neighbours in 3D never cover it.
    - **Used:** soft dot (`--filament-soft` fill, accent outline), faint accent leader, number badge beside the label.
    - **Free:** outlined dot, `--line` leader, muted label.
  - Clicking a used pad selects that switch; clicking a free pad starts **Add a switch** with that pin chosen.
  - Colors come from the theme tokens, as on the landing (`--foreground` lines on `--cream`), and the drawing re-renders on theme change and resize, as `SimpleCard` does.
  - Without WebGL (`webglAvailable()` false): no picture; the switch list and a pin row (`D0 … D5` chips, filled when used) do the same job.
  - **BOOT callout:** a leader from the BOOT marker up to a `BOOT` label above the board, clear of the drawing, flipping to the left when the label would run past the right edge. Marker, leader and label all select the BOOT row (§3.4), and they use the same three states as a pad (selected: dark ring and `BOOT` pill; used: soft accent; not set up: outlined).
  - **View toggle** (`Top` | `3D`), a small segmented control at the top left of the drawing. Top looks straight down with USB-C up, so D0–D5 run down the left edge; 3D is the landing's isometric camera. Switching re-renders the still image and re-projects the markers; nothing else changes. The choice is remembered per browser in `localStorage` (`simple-board-view`), read and written inside try/catch, and falls back to the default when storage is unavailable. It is a viewing preference, not saved to the account or the switch. Default: 3D (§5.5).
  - Pin labels sit in a column left of the board, each with a leader to its pad (the landing's callout style), with the switch number beside the label when the pin is used. Dots are sized to the projected pad pitch. The label row and leader are part of the click target, so a pad is easy to hit even when the dots are small.
  - The left column is wider than Round's (`flex: 1 1 380px`, drawing up to 360 px) so the board is readable. The camera frames the board centred in the column, with equal side margins wide enough for the pin label column on the left.
  - The mockup renders the real model: it ports `buildXiao`, `buildHeaders` and the line style to plain JS and loads three.js 0.186.1 from jsDelivr. The editor imports the originals instead. If WebGL or the CDN fails, the mockup falls back to a flat drawing.
- **Switch list** (`Switches · 3 of 6 pins`; the count is D pins only).
  - **BOOT row first, always** (§3.4), whether or not BOOT is set up.
  - Then one row per configured D channel, ordered by pin: the switch's number badge, the name (or `Room · Wall switch` when unnamed), and the pin in mono (`D2`).
  - The selected row is highlighted. Stale rows show the warn dot.
- **Add a switch** below the list, hidden when all six D pins are used ("All six pins are in use.").
- **No D channel configured:** "Nothing wired yet." under the BOOT row.

### 3.2 Right column: add flow

Three short steps on one panel, each answered by a click, in this order:

1. **What did you wire?** Two cards with a drawing each:
   - **Wall switch**: "A lever that stays up or down."
   - **Push button**: "A button that springs back."
2. **Which pin?** Free pins only, as chips (`D3 · GPIO 21`). Preselected when the flow started from a pad. Skipped when one pin is free.
3. **Which room or zone?** The same room grid Round uses for a new page (name, "Room · 4 lights · 3 scenes").

Picking the room creates the draft channel with today's defaults (`defaultSimpleChannel` with the chosen kind) and selects it. Cancel returns to the selected switch (BOOT when nothing else exists).

### 3.3 Right column: selected switch

Top row, like Round's page header:

- **Name** (optional, 40 characters, placeholder = room name). Same big underlined input as Round's page name.
- **Room or zone** select. No "Not used" option; removing is its own action.

Then:

- **Wired as** line: `Wall switch on D2 · Change`. Opening it shows the two kind cards and the pin chips. Changing the kind keeps today's `withKind` mapping and shows a notice naming what changed (e.g. "Double-click scenes moved over; hold cleared."). Changing the pin moves the settings to the free pin (§5.3).
- **Gesture cards**: unchanged `GesturePicker` cards (On / Off and Double-click for a wall switch; Click, Double-click and Hold for a push button), with the same options and notes as today, minus the firmware-gated labels.
- **Dim follows Click** (decided by the user, 2026-09-28): a Dim hold always dims what the Click card targets, as `simple-hold-dim.md` §1 describes. The Hold card shows no light choices for Dim, changing Click's target moves Dim with it (`withTarget` → `withDimOnTarget`), and `PUT /channels` aligns a differing `dim` target instead of refusing it. Before this, Dim took Click's target once and could drift apart after Click changed. All saved Dim holds matched their Click target when this shipped.
- **Remove *name*** at the bottom, naming the switch as the list does ("Remove Front door", or "Remove Kitchen · Push button" when unnamed), so it is clear the board stays. Inline confirm as Round's "Delete page": "Remove Front door? D2 becomes free and does nothing until you add a switch there." · Remove · Keep. Afterwards: "Removed Front door. D2 is free." Not "Delete switch" (the boards in the tabs are switches too) and not "Free pin" (the pin is a side effect, not the action).

BOOT uses this same editor, with the differences in §3.4.

### 3.4 BOOT

BOOT is the button on the board. The firmware already treats it as a push button whose Click and Double-click are free; only a Hold recipe replaces the 3 s re-pair (`docs/definitions.md`, "momentary channel"). The UI follows that: BOOT is a normal switch, and only Hold is special. No firmware or API change; it is the same `boot` channel the console saves today.

**List row**, pinned at the top of the switch list, apart from D0–D5 and not counted in "of 6 pins":

- Not set up: dashed `B` badge, "BOOT button", "On the board · set it up to test", `BOOT` in mono.
- Set up: filled `B` badge, the name or "BOOT · *room*", "On the board · push button".

**Not set up, selected** (the first-run screen when nothing is wired, and whenever the BOOT row is picked before it has a room):

- Heading "Start with the BOOT button" when no D channel exists, otherwise "BOOT button".
- "The small button on the board. Use it to check that everything works before you wire anything: pick a room, save, then press BOOT."
- The room grid (same as the add flow). Picking a room creates the `momentary` BOOT channel with the defaults, selects it, and says: "BOOT now toggles *room*. Save, then press BOOT on the board to test."
- Note: "Click will toggle the whole group. Holding BOOT for 3 s still re-pairs with the Bridge unless you change Hold."
- When no D channel exists: an "Or add a wired switch" link that opens the add flow.

A board opens on BOOT when it has no D channel; otherwise on the first configured D channel.

**Set up:** the §3.3 editor (name, room, gesture cards), except:

- **Wired as** is fixed text, no Change: "Push button · the BOOT button on the board". There is no type or pin to pick.
- **Hold** card: nothing set reads **"Re-pairs with the Bridge (hold 3 s)"** (not muted, not "Does nothing"), and its first option is **Re-pair with the Bridge** instead of Nothing. The other options are the same as any push button: Dim, and Turn off all of *room* when Click controls a single light.
- With any Hold other than re-pair, a warning under the cards: "BOOT no longer re-pairs with the Bridge. To re-pair, set Hold back to Re-pair, or reinstall over USB from Setup."
- **Clear BOOT settings** instead of Remove *name*, with confirm "Clear BOOT's settings? Hold goes back to re-pairing with the Bridge." · Clear · Keep. The BOOT channel is deleted; the row stays, back to "not set up".

### 3.5 Words

| Today | v2 |
| --- | --- |
| Toggle switch | **Wall switch** |
| Push button | Push button |
| Channel (in UI copy) | **Switch** (the thing on the wall); pins are D0–D5 |
| `Save channels` (and Round's `Save pages`) | **Save changes** (both products; "switch" also names the boards in the tabs, and **Save all (n)** saves every board) |
| "Channels without a room do nothing." | "Unused pins do nothing." |
| "Not used" (room option) | removed; **Remove *name*** (e.g. "Remove Front door") |
| "Missing from snapshot" | **"Not on the Bridge anymore"** |
| BOOT row among the pins | **BOOT button**, "On the board", pinned at the top |
| BOOT hold "Nothing" / "Re-pair with Bridge" | **Re-pair with the Bridge** (option); "Re-pairs with the Bridge (hold 3 s)" (summary) |
| Remove (on BOOT) | **Clear BOOT settings** |

`ChannelKind` values (`maintained`, `momentary`) and API names stay as they are. `docs/definitions.md` and `lib/how-to.ts` change their Simple copy to match.

### 3.6 Removed

- The whole-editor "Update firmware to configure this switch" banner and `fieldset disabled` for firmware < 0.3.0.
- The "Dim (needs firmware 0.4.0)" disabled option.

Replaced by one state: if a Simple board reports firmware below `SIMPLE_MIN_FIRMWARE`, the right column shows "Update this switch to set it up" with a link to `/setup?mac=…`, and nothing else. Keep `SIMPLE_MIN_FIRMWARE` and the server-side check (`firmware < 0.3.0` gets `{ rev, recipes: [] }`) so a board flashed from an old image still behaves; only the per-feature UI gates go. `SIMPLE_DIM_FIRMWARE` and `supportsHoldDim` are deleted.

## 4. Compatibility

- **Boards:** unaffected. The config poll output is byte-identical for the same settings (the label is not sent).
- **Existing settings:** every configured D channel appears in the switch list, unnamed. A saved BOOT channel shows as a set-up BOOT row with its gestures; a saved BOOT `hold` shows as that Hold with the re-pair warning. Boards with no BOOT channel show the BOOT row as "set it up to test".
- **Four-channel boards** (firmware < 0.5.0, none registered today): the pin chips offer only the pins the board registered, as today.
- **Old console tabs** open during the deploy: their PUT omits `label`. The endpoint must treat a missing `label` as "keep the stored one", not "clear it", so an old tab cannot wipe names.

## 5. Decisions

All decided by the user on 2026-09-28.

1. **BOOT is a normal push button, pinned at the top of the switch list; only its Hold is special** (§3.4). This reverses an earlier decision the same day to put BOOT in a collapsed Board section. The user pointed out that most people, the user included, test with BOOT before committing to a full installation, so it must be the first thing on screen, and that only Hold competes with re-pairing. The first-run screen suggests starting with BOOT.
2. **Switches get an optional name** (`simple_channels.label`, console only, §2).
3. **A switch can move to another free pin**, under "Wired as → Change" (§3.3). It is a delete + insert of the same settings under a new `channel_id` in one save.
4. **"Wall switch"** replaces "Toggle switch" in the UI (§3.5). It names the object people have and no longer collides with the *toggle* action.
5. **Board picture:** the user's Claude Design XIAO model, already rendered by the landing (§3.1), with a **Top / 3D toggle**. **3D is the default** until the viewer picks Top (Claude had recommended Top for easier clicking; the user chose 3D, matching the landing).

## 6. Checklist

### Console (`hue-switch-console`)

- [x] User answers §5 (2026-09-28)
- [x] User approves this spec (2026-09-28)
- [x] `db/schema.sql`: `alter table simple_channels add column if not exists label text`; regenerate `lib/generated/schema.ts`
- [x] `PUT /api/switches/{mac}/channels`: optional `label` (trim, ≤ 40, empty → null, missing → keep); returned in `channels`
- [x] `SimpleChannelConfig.label`; `simpleChannelsEqual` compares it
- [x] `app/landing/simple-render.ts`: take a camera (`"iso"` | `"top"`), return pad and BOOT screen positions; landing overlay moves to its caller, unchanged on screen
- [x] Top / 3D toggle, remembered in `localStorage` (§3.1)
- [x] `app/switches/simple-channels-editor.tsx` rewritten per §3 (board drawing with pad overlay, switch list with the BOOT row first, add flow, selected switch, BOOT first-run screen and Hold per §3.4)
- [x] `app/switches/workspace.tsx`: "Save changes", new status line; drop the `openChannel` accordion state in favour of a selected switch
- [x] Firmware gates removed per §3.6
- [x] Copy per §3.5 in the editor, `lib/how-to.ts` and `docs/definitions.md` ("How the user assigns (console, Simple)")
- [x] `docs/changelog.md` entry
- [x] Deployed; checked on production with a Simple board by the user (AGENTS.md: no local Playwright for `/switches`)

### Round (`hue-round-switch`)

- [x] No change

### Simple (`hue-simple-switch`)

- [x] No change
