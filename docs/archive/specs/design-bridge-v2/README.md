# Handoff: Bridge page v2 (`/bridges/[bridgeid]`)

## Overview
A redesign of the bridge workspace in `hue-switch-console`. The goal: **configure a gesture where it is shown**. The two-pane flow is gone. Today you pick a slot on the left, click a light or scene on the right, and read hint text telling you what's valid. In v2, each gesture (Tap, Double tap, Click, Hold) opens in place and offers only choices that are valid for it. The Round dial becomes the visual centre of the page.

Everything outside this page stays as it is: the Shell, nav, the console theme picker (all 17 themes in `app/themes.ts` / `globals.css`), the Round page themes (`lib/round-themes.ts`), the API contract and the data model.

## About the design files
`Bridge v2.dc.html` is a **design reference built in HTML**. It's a working prototype of the intended look and behaviour, not production code. Rebuild it in the existing Next.js + Tailwind code, using the codebase's tokens (`bg-cream`, `border-line`, `text-muted`, `bg-filament-soft`, …) and existing helpers (`lib/pages.ts`, `lib/simple-channels.ts`, `lib/recipes.ts`). Open the HTML file in a browser to try it (keep `support.js` next to it). The data in it (rooms, switches) is made up.

## Fidelity
**High fidelity.** Colors come only from the existing CSS variables. Type is Geist / Geist Mono. Spacing follows Tailwind steps. Match it closely.

## Files to change
- `app/bridges/[bridgeid]/workspace.tsx`: remove the right-hand "Lights and scenes" pane, the `simpleAssignHint` / `roundAssignHint` hints, the `assignTarget` / `assignRoundTarget` / `assignSimpleTarget` notice paths, and `TargetButton` / `TargetGroup` as a pane. Keep the header, switch tabs, card header, rename and save logic. Add "Save all".
- `app/bridges/[bridgeid]/round-pages-editor.tsx`: new two-column layout (dial stage + page detail). The page list becomes a dial strip. Device settings move into a collapsible footer row. Replace both `window.confirm` calls.
- `app/bridges/[bridgeid]/simple-channels-editor.tsx`: collapsible channel rows. Gestures use the new inline picker. Remove the Confirmation block (its sentences move into each row's summary line).
- New shared component, e.g. `gesture-picker.tsx`, used by both editors (see below).
- `round-dial.tsx`: unchanged, just used at larger sizes (big dial ≈ 208px, strip 56px, theme grid 60px). The CSS in `globals.css` has a fixed 8px ring and 16px inset. Scale these with size (the prototype uses `size/104 ×` each px value). Easiest: pass CSS variables from `RoundDial`.

## Layout

### Page shell (unchanged)
`Shell wide` (max-w-7xl, px-5 py-8, gap-6), header with nav, Theme button and account menu. Bridge header: `h1` "Bridge" (text-2xl semibold), then a meta line with the bridge id (mono), IP (mono), `N lights · N rooms · N scenes`, and `Snapshot … ago`.

### Switch tabs (unchanged)
Same buttons as today: name + dirty dot, `Round|Simple · seen …`, and "· update" in filament.

### Switch card
`rounded-xl border border-line bg-cream`. The header is unchanged (name, product pill, Unsaved/Saved pill, "Update to x" link, MAC · firmware · rev · how-to link, pencil rename). Below the header comes a `border-t` and then the product body.

### Round body: two columns, wrapping
- **Left stage**: `flex: 1 1 300px`, `bg-background`, padding 28×24, content centred, gap-5.
  - Big `RoundDial` of the selected page, with a "Preview · lights on/off" pill below it (rounded-full, border-line, text-xs muted). It switches the dial's `on` state.
  - **Pages**: section label (11px uppercase tracking .12em muted) with "N of 6" on the right. Below it a wrapping row of page items, each 68px wide: a 56px dial inside a 2px ring (`border-filament` when selected, otherwise transparent, 3px padding, rounded-full), and the name below (text-xs, foreground if selected, otherwise muted). Last item: "Add page", a 62px dashed circle with "+" and a filament label. Hidden at 6 pages.
  - Action row under the strip (text-xs muted): `← Move` · `Move →` · `Delete page` (opacity .35 when not possible). **Delete confirms inline**: "Delete {name} and its gestures?" with a `Delete` (danger) and a `Keep` button. No `window.confirm`.
  - **Theme** (above it: `border-t border-line pt-4`): a row with the "THEME" label, current theme name, and "Change/Done" in filament. When open: a grid `repeat(auto-fill, minmax(72px,1fr))` gap-2 of all 20 `ROUND_THEMES`. Each is a 60px dial rendered with the page name, sample scene and dots, plus the theme name. Selected: `border-filament` + `shadow-[0_0_0_1px_var(--filament)]`.
- **Right detail**: `flex: 999 1 420px`, p-6, gap-5.
  - A row (wraps) with two fields:
    - **Page name**: label "Page name · 6/12" (text-xs muted, mono counter). The input has no box, only a bottom border (`border-b border-line`, filament on focus), 20px semibold, maxLength 12.
    - **Room or zone**: a select.
  - **Gesture cards** Tap and Double tap (see the gesture picker below), then a "Ring" line: `Dims {room} (lights that are on)` / `Dims those lights` / `Unused` (from `computeDim`).
  - **Add-page mode** replaces the detail column. "New page" (18px semibold), then the helper line "Pick a room or zone. Tap will toggle it and double tap will turn it off. You can change both after.", then a room grid `minmax(180px,1fr)`. Each room button shows its name and "Room · 4 lights · 5 scenes". Then Cancel.
- **Device row** (full width, `border-t`): a collapsed button with the "DEVICE" label, the summary `Swipe left / right between pages · Screen sleeps after 30 s` (or `Screen always on`), and Change/Done. When open: the "Page swipe" choices (Left / right, Up / down) and "Screen timeout, seconds" (w-24 number input). Validation is unchanged: 0 or 10–600. On error the border and hint turn danger: "Must be 0 (always on) or 10–600 seconds.", otherwise the hint is "0 = always on. Not 1–9."

### Simple body: channel rows
Each channel is one row with `border-b border-line`.
- **Header button**: grid `84px | 1fr | auto`, padding 16×20. It shows:
  - the label in mono semibold 14 with `GPIO n` below it (11px muted);
  - the headline `{Room} · Toggle switch|Push button` (14 medium), or muted "Not used";
  - a summary line (13 muted) joining every gesture, e.g. `On / Off: lever up turns on, down turns off all of Kitchen · Double-click: cycles Cooking → Dinner`;
  - on the right, `Edit` / `Set up` / `Close` in filament.
  - When open, the header background is `bg-background`. **Only one channel is open at a time.**
- **When open** (px-5 pb-5, gap-3.5): the "Room or zone" select (`Not used` + groups), and a Type choice (`Toggle switch` / `Push button`, `flex-shrink:0`). For BOOT only "Push button" is offered, with the note "BOOT is always a push button." Then the gesture cards:
  - Toggle switch: **On / Off** (target only) and **Double-click** (Nothing [default] / Cycle scenes; when empty the summary reads "Does nothing"). Note: the current code's empty text, "Empty — double-click turns the target on" (`confirmationForSimpleChannel`: "double-click turns on"), should change to match.
  - Push button: **Click** (target only), **Double-click** (Nothing / Cycle scenes), and **Hold**. Hold offers Nothing (or "Re-pair with Bridge" for BOOT), Dim (with target chips), and "Turn off all of {room}". "Turn off all of {room}" has no target chips. It always targets the group's grouped_light, and it only shows when `holdOffAvailable(config)` is true, meaning Click controls less than the whole group. Dim stays disabled below `SIMPLE_DIM_FIRMWARE`, like today.
  - If Click is changed to the whole room while Hold is "turn off", Hold is cleared (`withTarget`) and the save-bar notice reads "Hold turn off removed: Click already controls all of {room}."
  - Notes under the cards (text-xs): "With a double-click set, a single click waits a moment before it acts." (muted); with Hold = Dim, "Hold ramps the light up or down, alternating each time. Let go to stop." (muted); with Click on the whole room and Hold empty, "Hold can turn off all of {room} when Click controls a single light." (muted); and for BOOT with Hold set "The button no longer re-pairs with the Bridge. To re-pair, reinstall over USB from Devices." (warn).
- Keep the existing firmware warning banner and the disabled fieldset when `!supportsChannelTypes`.

### Gesture picker (shared component)
- **Card**: `rounded-[10px] border`. Closed: `border-line`, transparent background. Open: `border-filament bg-background`.
- **Header button** (px-4 py-3.5, wraps):
  - the label, 88px wide (text-xs medium muted);
  - the summary sentence (15px; muted when the gesture is empty);
  - `Change` / `Done` (text-xs medium filament).
  - Only one gesture card is open on the page at a time.
- **When open** (px-4 pb-4, gap-3.5):
  1. **Action choices** (skipped for target-only slots). Each choice: `rounded-md border px-3 py-1.5 text-sm`. Selected: `border-filament bg-filament-soft`. Otherwise `border-line`.
  2. For toggle/on/off/dim/onoff, **"Which lights in {room}"**: chips for `Whole room|zone` (detail "all lights") and each light in the group. One can be selected. The chip style matches the action choices.
  3. For Cycle scenes, the hint line "Click scenes in {room} in the order to cycle them. Up to 8." (or "3 of 8 · click order is cycle order"). Then **scene chips**, clicked to add or remove. A selected chip shows a round filament badge with its order number (18px, `text-filament-ink`, 11px semibold). Once 8 are chosen, unselected chips drop to opacity .4 and don't respond. With 2 or more scenes, an ordered list follows: mono number, name, ↑ ↓ (opacity .3 at the ends).
- **Only valid targets are ever shown**: lights and scenes from the gesture's group only, and scenes only when the action is Cycle scenes. So the old validation notices can't happen and can be deleted.
- **Changing the action keeps what still fits**: switching to toggle/on/off/dim keeps the current target if it is in the group, otherwise uses the whole room. Switching to scenes keeps any existing scene list.

### Summary sentences (header text and channel summary line)
- Nothing: "Does nothing". For BOOT hold: "Re-pairs with the Bridge". For a toggle switch's double-click: "Does nothing".
- `toggle` → "Toggles {t}"; `on` → "Turns on {t}"; `off` → "Turns off {t}".
- `dim` → "Dims {t} up or down while held".
- `onoff` → "Lever up turns on, down turns off {t}".
- `scenes`: 0 → "Cycles scenes — none picked yet"; 1 → "Recalls {scene}"; more → "Cycles A → B → C".
- `{t}` is "all of {Room}" for a grouped light, otherwise the light's name.

## Behavior changes
- **New Round page**: after picking a room, the page is created with a name taken from the room (≤12 characters), theme `ember`, tap = toggle grouped_light, double tap = off grouped_light. This replaces the "Use this room for tap and double-tap" button.
- **Changing a page's room** no longer asks `window.confirm`. It resets tap and double tap to the defaults above and shows the notice "Gestures reset for {Room}: tap toggles it, double tap turns it off."
- **Changing a Simple channel's room**: the target becomes the room's grouped light and double-click and hold are cleared. Choosing "Not used" deletes the config.
- **Changing a Simple channel's type**: to toggle switch, the target is kept, double-click is cleared unless it cycles scenes, and hold is cleared. To push button, the target is kept.
- **Save bar** (sticky bottom-3 inside the card, unchanged style): `Save pages|channels` and `Discard` (both at 50% opacity when nothing changed), then a status line:
  - after a save, in ok color: "Saved · rev N. The switch picks this up on poll, or immediately after reboot.";
  - with changes, in filament: "Unsaved changes";
  - otherwise, muted: "Empty gestures do nothing." / "Channels without a room do nothing.".
  - **New**: when other switches have unsaved drafts, the right side shows "Also unsaved: {names}" and an outlined filament button "Save all (N)". It calls the existing PUT once per dirty switch (`/pages` or `/channels`).
- The stale-assignment warning and "Clear stale" stay. Put them as a warn line above the save bar.
- Light chips no longer show on/off (the snapshot can be hours old).

## State (on top of what `workspace.tsx` already has)
- `openGestureKey: string | null` (e.g. `${mac}:${pageId}:short`). Only one open at a time. Cleared when switching board or page, and after a save.
- `openChannelKey: string | null` (Simple).
- `addingPage: boolean`, `confirmDeletePageId: string | null`, `pageThemeOpen: boolean`, `previewOn: boolean`, `deviceOpen: boolean`.
- `selectedSlot` / `pageSlot` and the whole "click a target on the right" path go away.

## Design tokens
Use only the existing CSS variables in `app/globals.css`: `--background --foreground --cream --muted --line --filament --filament-ink --filament-soft --ok(-soft) --warn(-soft) --danger(-soft)`. There are no new colors.
- **Radii**: 6px (controls), 10px (gesture cards, save bar), 12px (cards, tabs), full (pills, dials).
- **Type sizes**:
  - 24/600: h1
  - 20/600: page name
  - 18/600: New page title
  - 16/500: card title
  - 15: gesture summary
  - 14: body and controls
  - 13: secondary lines
  - 12: labels and meta
  - 11: uppercase section labels (tracking .12em) and pills

## Files in this bundle
- `Bridge v2.dc.html`: the interactive prototype. Open it in a browser. Its Tweaks let you pick which switch opens first and the big dial size.
- `support.js`: the runtime the prototype needs. Not for production.
