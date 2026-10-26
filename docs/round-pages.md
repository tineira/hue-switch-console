# Round pages

Behavior contract for the Round switch: how pages work on the circle and in the console, and what the poll carries for them. [`hue-round-switch`](https://github.com/tineira/hue-round-switch) implements the circle side; this console implements the rest. The HTTP wire format is in [`device-api.md`](device-api.md), the product model in [`definitions.md`](definitions.md). The Round repo's `docs/pages-requirements.md` points here; there is no second copy.

Section numbers start at 4 and some are skipped, so references from code and the firmware repo (§8.1, §8.2, §11.2, §13, rules 1–25, also cited as "decision N") keep their meaning.

| Repo | Role |
| --- | --- |
| `hue-round-switch` | 240×240 circle. One active page at a time. Center gestures + brightness ring. Swipe changes page. |
| `hue-switch-console` | Page CRUD (room/zone group, recipes, scene lists, axis, theme, name). Sends `group` + dimmer targets in the poll. |
| `hue-simple-switch` | Not affected: GPIO + channels. The console UI branches by product. |

The console never calls the Bridge. The Bridge never sees the console. A finger on the circle never waits for the web.

A page is anchored to one Hue group (`room` or `zone`). Name, theme, tap and double tap live on the page; lights and scenes in its recipes come only from that group. Several pages live on one switch, and a swipe (axis set per switch in the console) moves between them; the swipe is local navigation, not a Hue recipe. A scene gesture is an ordered list of scenes from that group. Off is not a scene: it is `off` on the group's `grouped_light`, usually on double tap. Example:

```text
Page 1 "Living" (room Living)
 tap → cycle Relax, Bright, Night
 double → off Living
 ring → dim Living (group; on lights only)

Page 2 "Lamps" (room Living)
 tap → toggle Bedside 1
 double → toggle Bedside 2
 ring → dim only Bedside 1 and 2 (whichever are on)
```

The touch chip (CHSC6X) does not deliver gestures: tap, double tap and swipe are inferred in firmware from INT + (x, y). There is no hold on the circle.

---

## 4. Concepts

**Page.** Active configuration, **always** of a `room` or `zone`. Not a GPIO channel. The console creates, names, anchors to a group, orders, colors and deletes them. The firmware does **not** declare how many there are: it receives them in the poll.

**Page group.** `room` or `zone` from the snapshot + its `grouped_light`. Filters the topology: child lights and scenes of that group. Living and Patio are not mixed. A loose bulb is not a group (there is no page "without a room").

**Active page.** The one shown and the one receiving gestures. Only one. The swipe changes it. Remembered in NVS (reboot returns to the last one).

**Page dots.** At the bottom of the inner disc. One dot per page, in console order. The **filled** dot is the active page; the others are dim. With a single page they are not drawn. The dots are the circle's chrome, not an ornament. **Never overflow:** the whole row stays inside the inner disc; it is not clipped against the round edge nor pushed into the ring. A single row, never wrapped. See §5.1.

**Center gesture.** Happens on the inner disc (radius ≤ 88). Recipe events: `short` (tap) and `double_click` (double tap). In the console **both slots are always there**; the user assigns a recipe or leaves them empty. Empty = no-op. If double has no recipe, the tap does not wait for the second-touch window. **No hold** on screen.

**Ring / dimmer.** Outer disc (radius ~96–118). Not a recipe. Drag + brightness PUT on release. Target: the **group** or **the lights in the actions**, per §8.2. Like the Hue app: only lights that are **on**; if all of the target's lights are off, the drag **turns them on** at that %.

**Scene list.** `recall_scene` recipe with 1–8 scenes from the **page's group**, in the order the user sets in the console. One item = a plain recall. Several = rotate. The Bridge does not rotate: each touch is a PUT to one `rid`; the device picks the next.

**Page swipe.** Navigation gesture, not Hue. Axis `horizontal` (left/right) or `vertical` (up/down), **per device**, not per page. Configurable in the console.

**Page theme.** RGB565 palette for the circle (background, ink, off, accent, ring). Not the web CSS theme (`ember`, `paper`, …). The console shows a round preview when choosing.

**Page name.** Main text **on the circle**. Edited by the user in the console. Can be "Living", "Patio", a nickname.

**Active scene.** Line under the name, only if that page has a scene list and the Bridge (or the last recall) says which one is set. It is that scene's Hue name, not a hint. If there is no active scene (off, toggle, custom), that line is **not painted**.

**GPIO channel `c1`.** Only for migrating old boards. The current register sends `product: "round"` and `channels: []`. The Simple switch is not touched.

---

## 5. Fitting on the circle

Screen: 240×240, full circle. Center (120, 120).

| Zone | Radius | Use |
| --- | --- | --- |
| Inner disc | 0–88 | Page name, active scene (if any), dots, tap / double / swipe |
| Dead | 88–96 | Neither tap nor ring |
| Ring | 96–118 | Dimmer. Does not change page |

Arduino built-in font (6×8 cell at size 1):

| Size | Px / char | Chars in ~140 usable px |
| --- | --- | --- |
| 1 | 6×8 | ~23 — hard to read at arm's length |
| 2 | 12×16 | **~12** — page name |
| 3 | 18×24 | ~7 — short names, optional |
| 4 | 24×32 | ~5 — too big for a name |

Chord width of the inner disc at the title height (y ≈ 92, 28 px above center): ~167 px. With margin, **12 characters at size 2 fit**. "Living Room" (11) fits; "Master bedroom" (14) does not and is cut with an ellipsis.

### 5.1 Dots: they fit, or they shrink

The product maximum stays **6 pages**. Even so, the firmware does **not** draw at fixed sizes that leave the circle.

Placement:

- One row, centered on X, near the **bottom edge of the inner disc** (radius 88), not on the ring.
- Minimum ~8 px margin to the disc edge (the chord at that Y is the budget).
- Above it go the page name and, if it fits, the active scene. No gesture or dimmer hints push this row.

Fit (in this order; stop at the first that fits):

1. Ideal: 6 px diameter, 10 px gap.
2. Shrink the **gap** down to 4 px.
3. Shrink the **diameter** down to 4 px (gap 4).
4. Last resort (should not trigger with N ≤ 6): do not draw dots that would clip; paint `2/6` at size 1 centered on that row. No second row. No dot carousel (the swipe already is the carousel).

The row is centered. The active dot is filled with `ink`. The others: `ink` dimmed over the fill (same trick as the scene; `mute` on amber has no contrast). On swipe, only which one is filled changes (and the name/theme).

With 6 dots at 4+4 the width is ~44 px; the chord at the bottom of the inner disc is >100 px. Steps 2–3 exist so nothing breaks if the vertical layout pushes the row toward the edge (narrower chord).

### 5.2 Active scene: one line, or nothing

Under the page name, **size 1**. Color: ink blended with the fill (not raw `mute`: in palettes like Night, mute on amber is unreadable). A single line. No wrap.

- Only if the page has `recall_scene` and there is a `rid` from that list to show: the **last local PUT** (NVS), or a `status.active` GET **only to refresh the name** (not to pick the next rid in the cycle; §8.1).
- Lights off, toggle recipe, or none of the list to paint → the line is **not drawn** (no "Off", no "—").
- The name comes in the poll (`targets[].name`, the Hue one). The device does not guess.

Overflow (in this order):

1. Paint size 1, centered, within that Y's chord minus 8 px margin.
2. If the string doesn't fit, truncate and add an ellipsis (`Relax eveni…`). Typical: ~16–18 characters.
3. NVS stores at most 24 characters; painting trims to what fits.
4. If not even 8 characters + ellipsis fit (almost impossible): omit the line. The page name and dots do not shrink to make room.

Size 2 is not used for the scene (the title is the page). No second line.

**Layout of the Ready state:**

```text
        · page name (size 2, max 12)
        · active scene (size 1, ellipsis) — only if one is set
        · page dots (2+ pages)
        · brightness ring if the dimmer target is light / grouped_light
```

**No instruction copy** in Ready: no `Tap to toggle`, `Tap to cycle scenes`, `Drag ring to dim`, `Double-tap to turn off`, `Assign in console`. The disc does not teach its own use. System states (Wi‑Fi, pairing, error) do get a status line, not a how-to.

On swipe, the dots update **immediately** (the filled one moves). The rest of the disc need not animate.

System states (Wi‑Fi, pairing, error) are **not** pages. They stay full screen, without swipe or dots.

A single page: no dots are drawn, the swipe does nothing visible (gesture ignored). The name is still shown.

---

## 6. Gestures

The CHSC6X delivers INT + one point. Everything in this section is firmware.

### 6.1 Classification by **start** zone

| Where the finger starts | What it is |
| --- | --- |
| Inner disc | Tap, double, or page swipe |
| Ring | Dimmer. Never changes page, even if the finger slides into the center |

A stroke is classified on touch-down. It is not reclassified mid-gesture.

### 6.2 Center — recipes

| Gesture | Recipe event | Condition |
| --- | --- | --- |
| Tap | `short` | Little movement on release. If double **has a recipe**, waits ~350 ms for a second tap |
| Double tap | `double_click` | Second tap within the window, same disc. Only if double has a recipe |

Slot without a recipe: no-op. There is **no** `double_click` → `on` fallback on the circle (that belongs to the wall's `maintained` contact).

If `double_click` **has no recipe**, the tap does not wait for the second-touch window. Having a recipe on double is what delays the tap ~350 ms. There is no separate "enable gesture" checkbox.

The tap fires on **release**, never on touch-down.

**No hold on the circle.** A "still ≥ 600 ms" timer fights slow swipes and the CHSC6X (the firmware already has to guess the lift: no point for 80 ms, INT high for 400 ms). The swipe is decided **by displacement only** along the axis, as soon as it crosses the threshold, without waiting for a timer. Off lives on `double_click`. The **3 s BOOT** hold (re-pair) does not change: it's the XIAO's physical button.

### 6.3 Center — page swipe

Not a recipe. Does not call the Bridge.

- **Device** axis: `horizontal` (default) or `vertical`.
- Minimum travel along the axis ≈ 40 px. As soon as it's crossed, it's a swipe (no waiting for release or any hold). The orthogonal axis is ignored (a shaky tap does not change page).
- Direction: swipe **left** → next page (index +1); right → previous. If the axis is vertical: up → next, down → previous.
- Wrap: last +1 → first, and the reverse.
- One page: the gesture does nothing.
- Feedback: on change, the new page is painted immediately. No slide animation.
- The active index is stored in NVS.

### 6.4 Ring — dimmer

Angular position 1–100, PUT on release. Target = the page's **dimmer set** (§8.2), not an extra slot.

- **Group** target: one PUT to `grouped_light` (the Bridge, like the app, usually touches only the lights that are on; if the group is off, the drag turns it on).
- **Action lights** target: GET those lights; PUT `dimming` only to the ones that are `on`. If none is on, PUT `on` + `dimming` to all of the set. The ring % is **absolute** (all lights that are on end at the same 1–100), not a relative scale.
- No target → no ring.

The page swipe does **not** live on the ring. The ring is not "configured" as a recipe gesture.

### 6.5 Outside pages

- The XIAO's physical BOOT, 3 s hold → Hue re-pair. Not a screen gesture. Not a recipe.
- Wi‑Fi / pairing / error states: the disc does not run recipes or change page.

---

## 7. What is shown

The disc in Ready has **no** help sentences. Only name, scene if any, dots, ring.

| Situation | Title | Below |
| --- | --- | --- |
| Tap → toggle / on / off | page name | (nothing) |
| Scene list, one active | page name | that scene's Hue name (ellipsis) |
| Scene list, none active / lights off | page name | (nothing) |
| Page without recipes | page name | (nothing) |
| Several pages | name + dots (filled = active) | scene if applicable |

Page names > 12 characters: the console warns; the device truncates with an ellipsis. Scenes: §5.2. Characters: ASCII plus the circle set (ñ, á, é, í, ó, ú, ü, ç, ¿, ¡ and the other letters the built-in font has; list in `ROUND_CIRCLE_CHARS`, `lib/round-themes.ts`, and the archived [`round-accented-names.md`](archive/specs/round-accented-names.md) §2); other accented letters fold to the plain letter (Á → A, Ł → L), emoji are dropped. No line breaks.

System states (English, one line): `Wi-Fi...`, `No Wi-Fi`, `No Bridge`, `Press Bridge button`, `Token rejected`. They are not pages.

- `No Bridge`: the Bridge does not answer. The switch retries by itself and reconnects after a short Bridge or Wi-Fi outage without asking for the Bridge button.
- `Press Bridge button`: no saved key, a BOOT 3 s hold, or the Bridge rejected the saved key twice. The switch pairs again by itself once the button is pressed.
- `Token rejected` (console 401): full screen only when the switch has no recipes. With recipes, Ready stays and works, and a small error-colored dot at 6 o'clock (in the dimmer ring's gap) marks the rejected token.
- A failed command is not a screen: the button ring flashes the theme's error color for about 0.7 s and Ready stays on the page. There is no `Hue error` screen (firmware 0.5.27 and later).

---

## 8. Recipes per page

A recipe is still a Hue action + target(s). On Round the key is `(pageId, event)` instead of `(channelId, event)`.

| Event | Default Hue action | Targets (always from the page's group) |
| --- | --- | --- |
| `short` | `toggle` | the group's `grouped_light`; or a **child** light; or a scene list from the group |
| `double_click` | `off` | the group's `grouped_light` (typical); or a child light; or another scene list from the group |

Empty = does nothing. Saving incomplete is valid (tap only, no double). A target outside the group is rejected by the console.

**Dimmer:** the user does not pick a "ring" slot. The console computes the set on save (§8.2).

### 8.1 Scene list (rotate)

Clip v2 has no "next scene". On Round, `recall_scene` is **an ordered list** of 1–8 `rid`s of type `scene`.

| List | Behavior when the gesture is used |
| --- | --- |
| 1 scene | PUT `recall.active` to that `rid` |
| 2–8 scenes | applies the **next** one in the list (wraps to the first) |

Rules:

- All scenes in a list belong to the **page's group**. The console does not show (or allow) scenes from another room/zone.
- The **order is edited by the user** in the console (add, remove, drag / arrows). That order is the cycle order.
- Off does **not** go in the list. There is no "scene off" in Clip v2 (`recall.action` is `active` \| `dynamic_palette` \| `static`). Turning off is **double tap** → `off` on that group's `grouped_light`.
- Smart scenes (`smart_scene` / `deactivate`) are not supported.
- A scene that disappears from the snapshot is marked stale in the console; the firmware skips it.
- The circle **does** show the active scene under the page name (§5.2). The title stays the page's.

When the gesture fires, the device:

1. Cycles from the **last `rid` set by this circle** (NVS, `pagesLastSceneRid`). It does not GET `status.active` to pick the next one.
2. If there is a last rid in the list → PUT the **next** one in console order (wrap).
3. If there is none (a **local** off / double tap cleared the rid, or it was never used) → PUT the **first**.
4. A `rid` the Bridge answers with **404** is skipped; the next in the list is tried. No `UI_ERROR` for the whole gesture if another PUT succeeds. If all fail, it is an error.
5. The PUT is the usual one: `PUT /clip/v2/resource/scene/{rid}` `{"recall":{"action":"active"}}`. That `rid` is saved in NVS.

The `status.active` GET is only for **painting the name** in Ready (refresh on entering the page / after the PUT / ~20 s poll), not for picking the next rid in the cycle. Changing a scene in the Hue app does not re-sync the disc's cycle (it may be one step behind the phone). That is the contract, not a bug.

After the PUT (or on entering the page), that `rid`'s `name` is painted. A local off clears the cached rid → the next cycle starts at the first.

The finger does not wait for the console. The PUT to the Bridge (LAN) **does happen**; the circle **does not freeze** meanwhile: tap, double, ring and swipe stay live. Firmware design: `hue-round-switch/docs/archive/specs/input-during-hue.md`.

### 8.2 Dimmer set (ring)

The console computes it **on save** (snapshot). The firmware does not infer the room from a scene.

On each page, the poll sends `dim`:

```text
dim: null
  | { mode: "group", rid: "<grouped_light>" }
  | { mode: "lights", rids: ["<light>", "<light>"] }
```

`null` → no ring.

Rules, in this order:

1. **There is a `recall_scene` on tap or double** → `mode: "group"` (the page's `grouped_light`). A scene paints the room; the ring is the Hue app's slider.
2. **No scenes, and some recipe targets the group's `grouped_light`** (e.g. tap = bedside lamp, double = off Living) → `mode: "group"`.
3. **No scenes and no group action: only child lights** (e.g. tap = Bedside 1, double = Bedside 2) → `mode: "lights"`, `rids` = those lights, without duplicates. The ring does **not** touch the ceiling light or the rest of the room.
4. Nothing dimmable → `null`. In `mode: "lights"`, dimmable = the snapshot's `caps` includes `"dim"`. If no light in the set has it, `dim: null`. A `grouped_light` target **counts as dimmable** (the Bridge decides which lights it touches).

Behavior on ring release (1–100 absolute):

| `dim.mode` | PUT |
| --- | --- |
| `group` | one `dimming` PUT to the `grouped_light`. The Bridge leaves the off ones off; if the whole group is off, the drag **turns it on**. |
| `lights` | GET those `rid`s. PUT `dimming` only to the `on` ones. If **none** is on → PUT `on` + `dimming` to all of the set. |

A stale rid (404) is skipped, like an orphan recipe. Two lights: at most two PUTs to `/light` (within the Bridge's rate limit).

---

## 9. Console

When a Round Display is selected (not a Simple switch), the left column does **not** list GPIO. It lists that device's **pages**.

### 9.1 Display settings (once per device)

- **Page swipe:** `Left / right` (default) or `Up / down`.
- **Screen timeout:** seconds until the disc sleeps (default **30**). **0** = always on. Range 0 or 10–600. Firmware design: `hue-round-switch/docs/archive/specs/idle-display.md`.
- The switch label (`switches.label`) is still the device name in the console list. It is **not** painted on the circle. The circle shows the **page** name.

### 9.2 Page list

- Add page.
- Delete (confirmed inline). That page's recipes go with it.
- Reorder (← Move / Move →). The list order **is** the swipe order.
- Pick a page to edit it.

Minimum 1 page (the last one cannot be deleted: it stays empty, assignable). Maximum **6**.

New page (in the UI): the **group must be chosen** (room/zone). Default name = the group's Hue name trimmed to 12 and folded for the circle (editable). Theme `ember`. Tap = `toggle` and double tap = `off`, both on the group's `grouped_light`.

The device **register** may create `p1` without a group. The human **Save** (PUT pages) **requires a group on every page**. Once saved, there is no product page "without a room".

### 9.3 Page editor

- **Group** — room or zone, required. Changing the group **resets** tap and double tap to the new-page defaults (toggle / off on the new group) with a notice; nothing else survives a room change anyway. Gesture choices **only** show that group's lights and scenes.
- **Name** — input, folded for the circle (`Niños` stays, `Ángel` → `Angel`), max 12 characters (warning if cut; the device truncates). It's what the circle shows.
- **Theme** — visual picker of **round dials**, the same dial as §10 (not the site's CSS dropdown). One palette per page: clicking a circle picks it (selection ring). On/Off in the preview to see lights on vs off. The name on the sample dial can be the page's. The user does not edit hex.
- **Gestures** — always **Tap** and **Double tap**, each a card that opens in place: Nothing, Toggle, Turn on, Turn off (with a light chip: the whole group or one light) or Cycle scenes. Empty = no-op; if double is empty, the tap does not wait.
- **Scene list** — clicking a scene chip of the group adds it (numbered in cycle order); clicking again removes it; reorder with ↑ ↓. Max 8. Off is not a list item.
- Each card's header says in words what it does, e.g. *"Cycles Relax → Bright → Night"*, *"Turns off all of Living"*, and a **Ring** line says *"Dims Living (lights that are on)"*, *"Dims those lights"* or *"Unused"*.

### 9.4 Simple switch

No UI changes: channels `boot` and `d0`–`d5` (`d0`–`d2` before Simple firmware 0.5.0), events `on` / `off` / `double_click` / `short`. The circle does not add `hold` to the shared schema.

The console tells products apart by what the firmware registers (`product: "round"` vs GPIO channels). An old Round that still sends only `c1` is treated as a one-page Round (§14).

---

## 10. Circle themes

A **closed** set of **20 palettes** for the GC9A01. Each palette names RGB565 colors, not web CSS. All 20 stay; the set is not trimmed.

Hex values: `lib/round-themes.ts` (the firmware converts them to RGB565). The page editor's picker draws each palette as the device does: background, inner disc, 270° dimmer ring, page name, sample scene if applicable, dots. **No** `Tap to cycle scenes` or other how-tos. **One** palette per page: a click picks it and the selected dial gets a ring. One On/Off preview toggle shows lights on vs off, and the sample dial uses the page name when there is one. The original picker prototype is archived at [`archive/prototypes/round-themes.html`](archive/prototypes/round-themes.html).

Fields per palette:

| Role | Where it's used |
| --- | --- |
| `bg` | Background |
| `ink` | Text and icons with the light on |
| `mute` | Secondary text, light off |
| `fillOn` / `fillOff` | Inner disc |
| `accent` | Ring and "on" / pressed state |
| `ringTrack` | Empty dimmer track |
| `error` | Wi‑Fi fail, failed-command ring flash, rejected-token dot (can be shared) |

Palettes (stable id, English copy):

| id | Name | Blurb |
| --- | --- | --- |
| `ember` | Ember | Current firmware. Charcoal, amber. **Default.** |
| `night` | Night | OLED black, electric amber. |
| `coal` | Coal | Almost off. Faint ember ring. |
| `graphite` | Graphite | Zinc, champagne. |
| `ink` | Ink | Blue-black, teal. |
| `ocean` | Ocean | Navy, sky cyan. |
| `nord` | Nord | Polar night, frost. |
| `plum` | Plum | Espresso, rose. |
| `violet` | Violet | Deep purple, lavender. |
| `dracula` | Dracula | Purple, pink. |
| `matrix` | Matrix | Black, phosphor green. |
| `forest` | Forest | Dark green, gold. |
| `copper` | Copper | Warm metal, rust. |
| `snow` | Snow | Cool white, blue. |
| `paper` | Paper | Cream, filament. |
| `sand` | Sand | Warm beige, terracotta. |
| `linen` | Linen | Ivory, olive. |
| `meadow` | Meadow | Sage, leaf. |
| `sky` | Sky | Pale blue, azure. |
| `porcelain` | Porcelain | Blush, rose. |

New page: `ember`. The user does not edit hex. An unknown `theme` in the config is treated as `ember`.

System states (pairing, error) may ignore the page theme and use the system palette (`ember` + error red), so an error is never painted "pretty" and unreadable.

---

## 11. Device ↔ console contract

There is still `POST /api/device/register` and `GET /api/device/config?mac=`. The GPIO (Simple) does not wait for this GET. Neither does the circle: NVS → Bridge.

### 11.1 Register (Round)

In addition to MAC, firmware, bridge, snapshot:

```text
product: "round"
```

No need to invent a `c1` / gpio `0` channel to satisfy the console. `channels` can be `[]`. The console does not assign recipes to pins for this product.

`hue-simple-switch` sends `"product": "simple"`. `product` is required with a `mac`: a register without it gets `400 product_required`, and the console never infers it from `channels`. A stored Round is wiped to Simple **only** when it registers with `"product": "simple"`.

### 11.2 Config sent to the Round

A Round's GET is **not** `{ rev, recipes[] }` with `channelId`. It sends `pages[]` with **group**, `dim`, names, themes, axis, timeout, and recipes with `pageId`. That **does** reach the device (the `switches.label` does not). Simple still receives `{ rev, recipes[] }` with `channelId`.

```text
{
  rev: 12,
  product: "round",
  pageSwipeAxis: "horizontal",          // or "vertical"
  screenTimeoutSec: 30,                 // 0 = always on; default 30
  pages: [
    {
      id: "p1",
      name: "Living",
      theme: "ember",
      group: { rtype: "room", rid: "living-room-…", groupedLightRid: "living-gl-…" },
      dim: { mode: "group", rid: "living-gl-…" }
    },
    {
      id: "p3",
      name: "Lamps",
      theme: "night",
      group: { rtype: "room", rid: "living-room-…", groupedLightRid: "living-gl-…" },
      dim: { mode: "lights", rids: ["bedside-1-…", "bedside-2-…"] }
    }
  ],
  recipes: [
    {
      pageId: "p1",
      event: "short",
      action: "recall_scene",
      targets: [
        { rtype: "scene", rid: "relax-…", name: "Relax" },
        { rtype: "scene", rid: "bright-…", name: "Bright" },
        { rtype: "scene", rid: "night-…", name: "Night" }
      ]
    },
    { pageId: "p1", event: "double_click", action: "off", target: { rtype: "grouped_light", rid: "living-gl-…" } },
    { pageId: "p3", event: "short", action: "toggle", target: { rtype: "light", rid: "bedside-1-…" } },
    { pageId: "p3", event: "double_click", action: "toggle", target: { rtype: "light", rid: "bedside-2-…" } }
  ]
}
```

The order of `pages[]` **is** the swipe order. The order of `targets[]` in a `recall_scene` **is** the cycle order. Page `id` is stable (not reused after deletion). `rev` goes up when pages, recipes, group, theme, name or axis are saved.

`recall_scene` uses `targets` (1–8 scenes from the page's `group`, with `name`). `on` / `off` / `toggle` use a `target` that is the page's `grouped_light` or a child light. The firmware does not accept a bare `target` on `recall_scene`.

If remote `rev` > local, the firmware **replaces** pages + recipes + axis (not a patch).

Simple switch: the GET is still `{ rev, recipes[] }` with `channelId`. It ignores `pages` if they ever came.

### 11.3 Legal events

| Product | Recipe events |
| --- | --- |
| Round, per page | `short`, `double_click` |
| Simple, per `maintained` channel | `on`, `off`, `double_click` |
| Simple, per `momentary` channel | `short` |

Round introduces no new events compared to the shared schema. `double_click` on the circle is the off slot (or another recipe), not a hold.

---

## 12. Data (console)

The console stores (schema: `db/schema.sql`):

- Product discriminator on `switches` (`product` text: `simple` | `round`).
- Round settings on the switch: `page_swipe_axis`, `screen_timeout_sec` (default 30; 0 = always on).
- A **pages** table per switch: `id`, `name`, `sort_order`, `theme`, `group` (room/zone + grouped_light rid), `dim` (`group` \| `lights` \| null).
- Round recipes tied to `page_id` + `event` (`short` | `double_click`).
- `recall_scene` on Round stores **several** ordered `rid`s, not a single `target_rid`.
- Simple switch recipes keep one `rid` per recipe (they don't rotate).

Limits the server validates:

| Limit | Value | Why |
| --- | --- | --- |
| Pages per Round | 1–6 | Dots + NVS + wall use |
| Name | 1–12 characters | Disc width at size 2 |
| Theme | id from the closed set | Predictable RGB565 |
| Gestures | tap and double always ready; recipe optional | Empty = no-op; no extra checkbox |
| Recipes | ≤ 12 (6×2) | Fits NVS; firmware can keep `kMaxRecipes` at 16 or lower it |
| Scenes per list | 1–8 | Usable cycle on the wall; JSON/NVS |
| Group per page | 1 room or zone; required on the human PUT. Register may leave `p1` without a group | Filters lights and scenes |
| Lights in `dim.mode=lights` | those of tap/double, ≤ 2 | One PUT per light that is on |
| Screen timeout | 0 or 10–600 s; default 30 | Disc sleep; 0 = always on |

---

## 13. Firmware (Round)

- Same poll: without recipes/pages ~1 min; with config at boot and every 1 h. The finger does not wait.
- Snapshot / register / console poll run **outside** the touch loop. Recipe / ring / page refresh are in `hue_job`.
- NVS stores `rev`, axis, `screenTimeoutSec`, pages (id, name, theme, group, `dim`), recipes (scene lists with `rid` + `name` folded for the circle, stored as UTF-8), active page index, last scene `rid` per gesture (cache).
- The poll's `dim` is authoritative. `dim: null` = no ring. The firmware does not infer the set from recipes.
- Screen sleep (firmware design: `hue-round-switch/docs/archive/specs/idle-display.md`). Backlight off after the timeout; the first touch wakes and does not act.
- Ring `mode: lights`: GET those rids + PUT to the ones that are on (or turn the set on if all are off). Do not put those GETs on the loop's stack.
- Rotating scenes: next rid from NVS (last local PUT) + PUT (LAN). `status.active` GET only for the name. A 404 in `targets[]` is skipped. A local off clears the rid. Does not call the console.
- On page change: paint immediately, GET the new target's Hue state (on/brightness) in the background. A swipe never blocks on the network. Unknown = off; the first tap sends **on**.
- Recipe and dimmer GET/PUT **also** do not block the touch loop. Last-wins if another gesture arrives. Ready does not use `UI_BUSY`. Firmware design: `hue-round-switch/docs/archive/specs/input-during-hue.md`.
- If a recipe's `pageId` no longer exists: ignore it. If the active index points to a deleted page: go to the first.
- If the paired `bridgeid` changes: drop pages, recipes and `rev` in NVS **before** the poll (the `rid`s belong to another Bridge), leave one default empty page. Do not treat remote `rev` 0 as "don't replace" if the bid changed.
- Revoked API key: the poll fails; what's in NVS **keeps** running on the LAN.
- `kMaxRecipes` is 16; with 6×2 (tap + double), 16 is plenty.

---

## 14. Old Round registers

A Round that registers only a `c1` channel with a `short` recipe (pre-pages firmware) is treated as a one-page Round: the console marks it `product: round`, creates page `p1` (theme `ember`), moves `c1`/`short` to `p1`/`short` and infers `group` from the target (light → its room; scene → its group; `grouped_light` → that one). If the group cannot be inferred, the page stays without a group until the user picks one (no ring). `dim` follows §8.2, and the next poll with a new `rev` delivers the §11.2 object.

Simple switch: no migration.

---

## 16. Rules

Numbered rules the console and the firmware rely on. Code and the Round repo cite them as "rule N" or "decision N".

1. **Pages ≠ GPIO channels.** The console defines pages; the firmware does not declare fake pins.
2. **Maximum 6 pages.** The disc shows dots; 8 is already tight.
3. **Name ≤ 12 characters**, size 2. Longer → ellipsis.
4. **Swipe axis per device**, default horizontal.
5. **Swipe left = next** (index +1). Right = previous. Vertical: up = next, down = previous.
6. **Wrap** in the carousel.
7. **Last active page** is remembered in NVS. A reboot returns to it.
8. **Page = one room or zone.** Recipes only from that group. **`dim` on save** (§8.2): scene or group action → `grouped_light`; only child lights → those lights; otherwise no ring. The ring is not a slot.
9. **No fallback** `double_click` → another recipe on the circle.
10. **Themes = the 20 palettes of §10**, closed set. Picker = grid of round dials. One per page. Default `ember`. Not the site's CSS theme.
11. **No hold on the circle.** Off lives on `double_click`. The swipe is decided by displacement, not a timer. BOOT 3 s hold (re-pair) does not change.
12. **Tap on release**, never on touch-down.
13. **Classification by start zone** (center vs ring) so swipe and dimmer don't fight.
14. **`recall_scene` = ordered list** (1–8) from the same room/zone. Repeating the gesture rotates. Off is `grouped_light` on double tap, not a scene.
15. **Scene order = console order.** The user edits it (drag / arrows).
16. **Under the page name, the active scene** (size 1, ellipsis, or nothing if none). The title stays the page. The poll sends `targets[].name`.
17. **Dots at the bottom = pages.** One dot per page, console order. The filled one is active. One page → no dots. One row inside the inner disc: shrink the gap, then the diameter; never overflow or two rows.
18. **No explanatory text in Ready.** No `Tap to toggle` or `Drag ring to dim`. The disc does not teach gestures. System states do have a status line.
19. **New page: tap and double visible and empty.** Assigned in the console or left empty. No gesture checkbox. The tap waits for double only if double has a recipe.
20. **Names on the circle = the circle set.** Page and scene: ASCII plus the accented letters the built-in 5×7 font has (`Niños` stays `Niños`); other letters fold to the plain letter (`Ángel` → `Angel`). Names are UTF-8 on the wire and in NVS; the firmware converts them to font codes when drawing.
21. **Ring like the Hue app:** only the target's lights that are on. If the whole target is off, the drag turns it on at that %. `mode: lights` uses an absolute % on each light that is on, not a relative scale.
22. **Tap = bedside lamp and double = group off** → `dim.mode = group` (rule 2), not the individual lights.
23. **Touches while Hue answers:** the disc keeps accepting input. Optimistic ack (invert, fill, scene, ring). Last-wins. No `UI_BUSY` in Ready.
24. **Tap = light A and double = light B** (two different `light`s): the disc fill is split (left = tap, right = double). The touch area and gestures do not change. Each side keeps the on state of its `rid`; the toggle does not use a single per-page bit. Any other layout: whole disc.
25. **Screen sleep:** per-device timeout in the console (default 30 s, 0 = always on). Black disc; the first touch only wakes.
