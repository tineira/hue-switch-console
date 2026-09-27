# Handoff: Signed-out landing page (hue.tineira.com)

## Overview
A redesign of the signed-out home page (`app/page.tsx`) of Hue Switch Console. Goal: a Hue owner or tinkerer should understand both switches within seconds and go to the setup guide or request an invite.

Page order:
1. Header
2. Hero with an interactive "bench": live Round and Simple demos that light a small room
3. Trust strip
4. "What you need": parts with technical drawings and Seeed Studio links
5. "From USB to wall in three steps"
6. Closing CTA band
7. Trademark line
8. Existing site footer (unchanged)

## About the design files
The files in this folder are **design references built in HTML**. They are prototypes that show the intended look and behaviour; they are not production code to copy. Rebuild them in the existing codebase (`tineira/hue-switch-console`: Next.js 16 App Router, Tailwind CSS v4, theme tokens in `app/globals.css`) following its patterns. Keep the page a server component and put only the interactive parts in small client components. Add no new dependencies.

- `Landing.dc.html`: the new page. Open it in a browser with `support.js` next to it. The logic class at the bottom of the file holds the exact behaviour, copy and gesture timings.
- `Current Landing.dc.html`: the current page, rebuilt from `app/page.tsx`, for comparison.
- `support.js`: the runtime that makes the `.dc.html` files open. Not for production.

## Fidelity
**High fidelity.** Colours, type, spacing, copy and interactions are final. Every colour is a theme token, except the physical-device colours listed in "Device colours" below.

## Themes on the landing page
- Only two themes here: **Ember** (dark, default) and **Paper** (light). The 17 themes remain for signed-in users.
- Default: follow `prefers-color-scheme` (light → Paper, otherwise Ember).
- The header has a 40×40 toggle that switches between the two.
  - Recommended: also write the choice to `localStorage["hsw-theme"]` (`ember` or `paper`), so it carries over after sign-in.
- Implementation note: the tokens are defined on `html[data-theme=…]`, and `layout.tsx` restores any stored theme before paint.
  - On `/`, while signed out, map any stored theme that is not `paper` to `ember`.
  - Do this in the theme-toggle client island: on mount, read `localStorage["hsw-theme"]` (falling back to `prefers-color-scheme`) and set `document.documentElement.dataset.theme` to `ember` or `paper`. Do **not** change the boot script in `layout.tsx`: it runs on every route and cannot tell whether the visitor is signed in. At most one frame shows the stored theme before the island corrects it; that is accepted.
  - The mapping on mount only changes the page, not storage. Only a click on the toggle writes `localStorage`. A signed-in user who picked another theme (say Nord), signs out and clicks the toggle on `/` loses that choice; this is accepted.
  - Remove `ThemePicker` from this page only.

## Layout (all widths)
- Root: `container-type: inline-size`. The prototype uses `cqi` units; plain Tailwind breakpoints are fine as long as the result matches at 375, 768 and 1280.
- `main`: `max-width: 1200px`, centred.
  - Side padding `clamp(18px, 4cqi, 48px)`, about 18–20px on phones.
  - Vertical gap between sections `clamp(56px, 8cqi, 104px)`.
- No horizontal scroll at 375px. Grids use `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`.

### 1. Header
Flex row, gap 8, padding-top 20.
- **Logo:** an 18px circle with a 2px `filament` border, bottom border transparent, rotated 45° (a ring with a gap). Next to it, "Hue Switch Console": 15px/600, letter-spacing −0.01em. Gap 10. Links to `/`.
- **Theme toggle:** 40×40, radius 8, 1px `line` border, `cream` background, hover border `filament`.
  - Icon: a 16px circle with a 1.5px `foreground` border, left half filled with `foreground`.
  - `aria-label`: "Switch to dark" or "Switch to light".
- **Sign in:** min-height 40, padding 0 14, radius 8, 1px `line` border, `background` fill, 14px/500, hover border `filament`. Links to `/login`.

### 2. Hero
Two-column grid: `minmax(min(100%,440px),1fr)` auto-fit, gap `clamp(36px,5cqi,64px)`, **align-items: start**. Stacks on phones.

**Left column** (flex column, gap 24, padding-top `clamp(8px,3cqi,48px)`):
- **Eyebrow:** Geist Mono 12px, uppercase, letter-spacing 0.08em, `muted`. Text: "Open source · For Philips Hue".
- **H1:** "Build a wall switch for your Hue lights."
  - `clamp(40px, 5.6cqi, 68px)`, line-height 1, weight 600, letter-spacing −0.035em, `text-wrap: balance`.
- **Lead:** "Flash a Seeed Studio XIAO from Chrome or Edge, pair it with your Hue Bridge, and choose what each button does. Presses go straight to the Bridge on your home network."
  - `clamp(16px,1.5cqi,18px)`/1.55, `muted`, max-width 34em.
- **Buttons** (flex-wrap, gap 10; each min-height 46, padding 0 20, radius 8, 15px/500):
  - Primary: `filament` background, `filament-ink` text. Label depends on sign-up mode (see "Sign-up mode copy"). Links to `/login`.
  - Secondary: "Read the setup guide". 1px `line` border, `background` fill, hover border `filament`. Links to `/how-to`.
  - In `closed` mode the primary button is already "Read the setup guide", so **omit the secondary button** (no duplicate).
- **Account line:** 14px `muted`, then a "Sign in" link in `foreground` with underline offset 3.

**Right column: the bench.**
- Container: `cream` background, 1px `line` border, radius 24, padding `clamp(16px,2.4cqi,28px)`. Flex column, gap 18.
- **Top row:** Geist Mono 11px, uppercase, letter-spacing 0.06em, `muted`, space-between. Left: "Try them". Right: "Same gestures as the real switch".
- **Device columns:** grid `minmax(min(100%,200px),1fr)`, gap 16. Two columns from about 440px of container width up. Each column is a flex column with gap 14, containing:
  1. **Room tile:** height 236, radius 16, overflow hidden, `background` fill, 1px `line` border. The device is centred inside; see "Room lighting".
  2. **Name block** (flex **column**, gap 4, so both gesture tables line up):
     - Name: 17px/600, "Round" or "Simple".
     - Below it, a link to `#parts`: Geist Mono 12px, `muted`, dotted underline, hover `filament`. Text: "XIAO ESP32-S3 · Round Display" or "XIAO ESP32-C6".
  3. **Gesture table:** 1px `line` top border. Each row is a `<button>`:
     - min-height 36, padding 0 8, bottom border 1px `line`.
     - Geist Mono 12px. Gesture name in `foreground` on the left, action in `muted` on the right.
     - Hover background `filament-soft`.
     - Clicking a row runs that gesture on the demo.
     - Round rows: tap · on / off, double tap · scenes, drag the ring · dim, swipe · next room.
     - Simple rows: click · on / off, double-click · scenes, hold · dim.
  4. **Readout:** Geist Mono 12px, `muted`, `aria-live="polite"` recommended.
     - Round: `→ {page} · {scene} · {level}%`, or `→ {page} · off`.
     - Simple: `→ Hallway · {scene · }{level}%`, or `→ Hallway · off`.

### 3. Trust strip
Grid `minmax(min(100%,230px),1fr)`, 1px `line` top and bottom borders. Each item: padding 22 20 22 0; title 15px/600; text 14px/1.5 `muted`, gap 6.
1. **Runs on your home network:** "Presses go from the switch to your Hue Bridge. The console only stores settings; switches keep working if it is down."
2. **Wi-Fi stays on the switch:** "Your Wi-Fi password goes from the browser to the switch over USB and never reaches the console."
3. **Free, no tracking:** "No ads and no analytics. Sponsorship does not unlock anything."
4. **Open source:** "The console is AGPL-3.0 and the firmware is MIT. Read it, fork it, host your own."

### 4. What you need (`id="parts"`)
- **H2:** "What you need". `clamp(26px,3cqi,36px)`/1.1, 600, letter-spacing −0.025em.
- **Sub:** "Two parts for a Round, one for a Simple. Both are made by Seeed Studio and sold by them and most electronics resellers." 15px/1.5 `muted`, max-width 40em.
- **Cards:** grid `minmax(min(100%,440px),1fr)`, gap 16. Each card: `cream` background, 1px `line` border, radius 20, overflow hidden.
- **Card header:** padding 14 18, bottom border `line`. Geist Mono 11px, uppercase, letter-spacing 0.06em, `muted`.
  - Left: "Round · exploded view" or "Simple · pre-soldered". Right: "mm".
- **Drawing area:**
  - Drawn on a fixed **520×440** canvas.
  - Scaled down to the card width with `scale(min(1, width/520))`, origin top centre. The area's height is 440 × scale.
  - Both cards use the same height, so the parts lists below start on the same line.
  - Grid background: `repeating-linear-gradient(0deg, var(--line) 0 1px, transparent 1px 24px)`, plus the same at 90deg.
  - Scaling: use a small client wrapper with a ResizeObserver, or CSS `zoom`, or container-query steps.
  - Everything in the drawing is `aria-hidden`; the parts list carries the meaning.
- **Drawing technique:** orthographic isometric in CSS 3D.
  - Stage transform: `rotateX(55deg) rotateZ(-45deg)`, with `transform-style: preserve-3d`.
  - Each part is a "slab". Copies of the shape are stacked every 1.5px in Z, with `line` fill for the sides and a 1px `muted` border on the bottom-most copy. The top face has a `cream` fill and a 1.5px `foreground` border.
  - To place 2D labels over the 3D stage, project a local point (x, y, z) to the screen, relative to the stage centre:
    - `sx = 0.7071·x + 0.7071·y`
    - `sy = (−0.7071·x + 0.7071·y)·cos55° − z·sin55°`
  - Label lines use `foreground` 1px. Dimension lines use `muted` 1px.
  - Labels and dimensions: Geist Mono 12px. Numbered balloons: 28px circles with a 1.5px `foreground` border, 13px text.
  - The exact geometry is in `Landing.dc.html`. A static SVG export of the same drawing is an acceptable alternative, as long as it uses `currentColor` and CSS variables so it follows the theme.
- **Round drawing** (stage centre 200,230). Layers, top to bottom:
  - **Glass:** Ø234 slab, Z 150, 7.5 thick. Inner radial gradient `cream`→`background`. Brightness ring: conic `filament` 170° plus `muted` to 270°, from 225°. Centre disc `filament-soft` with a 1px `filament` border.
  - **Display board:** Ø234, Z 100, 4.5 thick. Sockets, microSD slot and JST connector drawn **dashed** (hidden, on the underside), plus two small chips.
  - **XIAO ESP32-S3:** 126×107, radius 8, Z 0, 4.5 thick. Pads in `filament-soft`. Raised parts:
    - Metal cover 58×52 labelled "XIAO".
    - USB-C 18×34 with a 1.5px `filament` top border.
    - U.FL connector Ø10.
  - **Antenna:** 110×36 at Z −110, with a curved 1.5px `muted` cable up to the U.FL.
  - **Annotations:**
    - Dashed centreline.
    - "Ø 39" dimension across the glass.
    - "sockets / below" on the left.
    - Balloons 1, 2, 3 at the right, at y = 107, 230 and 320.
- **Simple drawing** (stage centre 260,215):
  - **XIAO ESP32-C6:** 140×168, radius 10, 4.5 thick. D0, D1 and D2 pads filled `filament`; the other pads `filament-soft`.
  - **Raised parts:** metal cover 84×76 "XIAO", USB-C 36×16 with a `filament` border, BOOT button 18×12, orange LED Ø9 with glow.
  - **Pin headers underneath:** 12×146 `foreground` strips with 14 3×3 pins, Z −12 to −32.
  - **Labels on the left**, with angled lines: "BOOT button", "D0 · switch 1", "D1 · switch 2", "D2 · switch 3". "LED" on the right.
  - **Dimensions:** 17.5 and 21 along the two edges.
- **Parts lists** (`<ol>`): each row is a grid `28px 1fr`, gap 12, padding 14 18, rows separated by `line`.
  - Number: Geist Mono 13px `filament`. Name: 15px/600. Description: 14px/1.5 `muted`.
  - Link: "seeedstudio.com ↗", 14px `filament`, `target="_blank" rel="noopener noreferrer"`.
  - Round list:
    1. Round Display for XIAO: "1.28″ round touch screen, 240 × 240, on a 39 mm board. The XIAO plugs into the sockets on its back." Link: https://www.seeedstudio.com/Seeed-Studio-Round-Display-for-XIAO-p-5638.html
    2. XIAO ESP32-S3: "21 × 17.8 mm, Wi-Fi and Bluetooth. Its USB-C port is how you install the firmware." Link: https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html
    3. 2.4 GHz antenna: "Comes with the XIAO. Plug it in: without it the screen says “No Wi-Fi”." No link.
  - Simple list:
    1. XIAO ESP32-C6: "21 × 17.5 mm. Up to three wall switches or push buttons on D0, D1 and D2; the BOOT button on the board works as one more." Link: https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C6-p-5884.html
    2. The switches already in your wall: "Toggle switches or push buttons, plus a few wires. The setup guide shows the wiring." No link.
  - **Checked against the firmware (2026-09-27):** the channel-to-pin mapping (`boot` GPIO9, `d0`/`d1`/`d2`) matches the `hue-simple-switch` README. The component positions are simplified; that is fine for an illustration.

### 5. Three steps
- **Heading row:** H2 "From USB to wall in three steps" (same style as the parts H2). On the right, "Full setup guide →": 15px/500 `filament`, hover underline, links to `/how-to`.
- **Grid:** `minmax(min(100%,280px),1fr)`, gap 16.
- **Each step:**
  - A visual box: height 180, radius 16, `cream` background, 1px `line` border.
  - The number: Geist Mono 12px `filament`, "01"–"03".
  - Title: 18px/600.
  - Text: 15px/1.5 `muted`. Copy is unchanged from the current `STEPS`.
- **Visuals:** reuse `StateVisual` from `app/how-to/visuals.tsx`.
  1. `face: "wifi"` at 112px (it reads "Wi-Fi..." on the `wait` ring; pass `version={null}` so no sub-line shows). Do not use `face: "loading"`: it reads "Loading... / Connecting". Next to it, a mono 11px `muted` list: "USB-C", "Chrome · Edge", "Web Serial".
  2. `face: "pairing"` at 124px.
  3. A mini config card: max-width 260, `background` fill, `line` border, radius 10, Geist Mono 12px. Rows: "Page 1 · Living"; "tap" → "on / off"; "double tap" → "Sunset, Aurora"; "ring" → "dim".

### 6. Closing band
- Container: `cream` background, 1px `line` border, radius 24, padding `clamp(24px,4cqi,44px)`. Flex-wrap, space-between.
- Left: title `clamp(24px,2.6cqi,32px)`/1.15, 600; text 15px `muted`.
- Right, three actions:
  - Primary button (mode label).
  - "Sign in", secondary style, links to `/login`.
  - "Privacy", 15px `muted` link to `/privacy`.

### 7. Trademark line
12px/1.5 `muted`, max-width 52em, 32px bottom margin. Text:

"Philips Hue is a trademark of Signify. This project is independent and is not affiliated with, endorsed by or sponsored by Signify. XIAO is a trademark of Seeed Studio."

### 8. Footer
Keep `SiteFooter` unchanged.

## Sign-up mode copy (`signupMode()`)
| | invite | open | closed |
|---|---|---|---|
| Primary label | Request an invite | Create an account | Read the setup guide (links to /how-to) |
| Hero secondary | Read the setup guide | Read the setup guide | none (the primary already is) |
| Account line | Sign-up is by invitation for now. Already invited? | Free. Already have an account? | New accounts are not open yet. Already have one? |
| Closing title | Sign-up is by invitation for now. | Make an account and plug in a board. | New accounts are not open yet. |
| Closing text | Ask for an invite and you get an email when your account is ready. The setup guide is open to everyone. | It is free. The setup guide walks through the wiring and the first install. | The setup guide and the firmware source are open to everyone. |

## Interactions and behaviour

### Round demo (client component)
- **Screen:** a 172px round screen with the same geometry as `.round-dial` (drawn at 104, scaled by `k = size/104`).
  - Track: conic from 225° over 270°, ring width 8k, inset 4k.
  - Level arc: `level × 2.7°`, opacity 1 when on and 0.35 when off.
  - Fill: inset 16k, `fillOn` or `fillOff`, inner 2k ring in the accent colour.
  - Name: Geist Mono 11k. Scene: 7k, shown only when on.
  - Page dots: 4k, 22k from the bottom.
- **Bezel:** `box-shadow: 0 0 0 9px #0b0b0c, 0 0 0 10px rgb(255 255 255 / 7%), 0 22px 44px rgb(0 0 0 / 40%)`.
- **Pages:** each page uses its own screen palette from `lib/round-themes.ts`, taken from `ROUND_THEMES`. Per-page themes are real: a Round page has its own theme (`docs/definitions.md`), and `ember`, `ocean` and `violet` all exist in `ROUND_THEMES`.
  - Living: ember. Scenes Sunset, Aurora, Relax, Read.
  - Kitchen: ocean. Scenes Bright, Lagoon, Dimmed.
  - Bedroom: violet. Scenes Neon, Nightlight, Relax.
- **Pointer gestures** (`touch-action: none`, pointer capture):
  - **Ring grab:** a press farther than 0.62·R from the centre grabs the ring. The level follows the pointer angle: `rel = (atan2(dx,−dy)° − 225 + 360) % 360`. If `rel > 270`, snap to 0 when `rel > 315`, otherwise to 270. Then `level = rel/270·100`, and `on = level > 0`.
  - **Swipe:** horizontal movement over 30px goes to the next or previous page. The scene resets to 0 and the light turns on.
  - **Tap:** movement under 6px. A second tap within **240ms** is a double tap, which moves to the next scene and turns the light on. Otherwise, after 240ms, the light toggles on or off.
- **Gesture buttons:**
  - "drag the ring" steps the level +25, wrapping to 25 at 90 or above.
  - "swipe" goes to the next page.
- **Initial state:** page Living, on, level 64, scene Sunset.

### Simple demo (client component)
- **Wall plate:** fixed physical colours in both themes.
  - Plate 108×160, radius 12, `linear-gradient(160deg,#f7f4ee,#e9e4db)`. Shadow: `inset 0 1px 0 rgb(255 255 255/80%), inset 0 -2px 0 rgb(0 0 0/8%), 0 1px 2px rgb(0 0 0/30%), 0 16px 32px rgb(0 0 0/35%)`.
  - Two 8px screws, 12px from the top and bottom.
  - Rocker well 60×96, radius 8, `#d9d3c9`.
  - Rocker radius 6, tilted with `perspective(240px) rotateX(∓12deg)`. Gradient flips with on/off (see the file). Transition 140ms.
- **Status LED tag** below the plate: a pill with `background` fill and `line` border, containing a 12px LED and the text "status LED" (mono 10px `muted`).
  - The LED reuses the timings of the existing `.led`: heartbeat 80ms every 3000ms at rest; `led-fast` (250/250ms) while holding; a single 300ms flash on each event.
- **Pointer gestures:**
  - Press and hold for **420ms** to dim: the level ramps ±3 every 60ms between 5 and 100, reversing at the ends.
  - Otherwise, click or double-click with the 240ms window.
  - Click toggles on/off; turning off clears the scene.
  - Double-click moves to the next scene (Bright, Tropics, Nightlight) and turns on.
- **Gesture button:** "hold" runs a 1.1s ramp.
- **Initial state:** on, level 92, scene Tropics.

### Room lighting (inside each room tile)
- **Dark layer:** `#000`, opacity `0.42·(1−L)` when on, `0.55` when off, where L = level/100.
- **Light layer:** opacity `0.95·L`.
  - White scenes use one colour: `radial-gradient(120% 90% at 50% −10%, c/.75 0, c/.32 38%, c/.08 70%, transparent)`.
  - Colour scenes use three radial gradients (75% 75%) at `18% −12%`, `82% −12%` and `50% 118%`, each `c/.8 0, c/.3 45%, transparent 80%`.
- **Ceiling lamp:** a 64×5 strip at the top centre, radius 0 0 6 6.
  - Filled with the scene colour, or a gradient of the palette for colour scenes.
  - Glow: `0 0 (10+30L)px (2+8L)px` in the first colour at `0.35+0.5L`.
  - When off, `var(--line)` and no glow.
- **Transitions:** `opacity 450ms ease` (none while holding). Rebuilding the gradient on every pointer move is fine.
- **Scene colours** (RGB):

| Scene | Colours |
|---|---|
| Relax | 255 172 92 |
| Read | 255 222 176 |
| Bright | 255 238 212 |
| Dimmed | 255 186 120 |
| Nightlight | 255 120 40 |
| Sunset | 255 128 52 · 255 64 112 · 176 64 210 |
| Aurora | 40 220 160 · 64 132 255 · 168 88 255 |
| Lagoon | 0 196 224 · 36 112 255 · 110 240 196 |
| Neon | 255 40 160 · 118 56 255 · 0 196 255 |
| Tropics | 255 176 0 · 255 72 96 · 0 200 170 |

### Accessibility
- The device visuals are `aria-hidden`; the gesture buttons are the keyboard-accessible controls. Give the bench `aria-label="Interactive preview of both switches"`.
- Under `prefers-reduced-motion: reduce`:
  - Turn off LED blinking, the pairing and loading ring pulses, and the room fade transitions.
  - State changes still apply.
- Touch targets are at least 36px in the tables and 40–46px for buttons.

## State (client islands only)
- **Round:** `{ page: 0..2, on: bool, level: 0..100, scene: index }`
- **Simple:** `{ on: bool, level: 5..100, scene: -1..2, holding: bool, pulse: counter }` (`pulse` re-keys the LED flash)
- **Theme:** `'ember' | 'paper'`
- No data fetching. `signupMode()` and the session redirect stay on the server, as today.

## Design tokens
All from `app/globals.css`:

| Token | Ember | Paper |
|---|---|---|
| background | #14110f | #f3eee4 |
| foreground | #f4eee6 | #1c1814 |
| cream | #1e1a17 | #fffaf2 |
| muted | #a89a8c | #6e675c |
| line | #3a322c | #e0d4c4 |
| filament | #e07a3d | #c45c26 |
| filament-ink | #1c140e | #fffaf2 |
| filament-soft | #3a2618 | #f6e4d6 |

**Device colours:** fixed, deliberately not theme tokens, like the existing `.round-face` and `.led`:
- Round screen palettes from `lib/round-themes.ts`.
- Bezel `#0b0b0c`.
- LED `#ff8a1f` on `#3a2410`.
- Step faces `#0d0d10` / `#f2f2f0` / `#8e8e96` / `#ff9f1c` / `#ffe000`.
- Wall plate colours as listed above.
- Scene light colours as in the table.

**Type:** Geist (UI) and Geist Mono (labels, readouts, drawings, gesture tables).

| Role | Style |
|---|---|
| H1 | 40–68 / 600 / −0.035em |
| H2 | 26–36 / 600 / −0.025em |
| Body | 15–18 |
| Small | 14 |
| Meta | 12 |
| Mono labels | 11–12 |

**Radii:** 8 (buttons), 10 (mini card), 16 (tiles), 20 (part cards), 24 (bench, closing band).

## Assets
- No images. Everything is CSS or inline SVG.
- Footer icons are unchanged (in `site-footer.tsx`).
- Product links go to seeedstudio.com (above). No Seeed images are embedded.

## Files
- `Landing.dc.html`: the full new page (open in a browser; its Tweaks let you switch `theme`: system/ember/paper and `mode`: invite/open/closed).
- `Current Landing.dc.html`: the current page, for comparison.
- `support.js`: runtime for the two files above. Not for production.

Suggested split in the repo:
- `app/page.tsx`: server. Layout, copy, mode logic.
- `app/landing/switch-bench.tsx`: client. Round demo, Simple demo, room lighting.
- `app/landing/parts-drawings.tsx`: static drawings plus a small client wrapper for scaling.
- `app/landing/theme-toggle.tsx`: client.
- Reuse `StateVisual` from `app/how-to/visuals.tsx` for the steps.
- Add any keyframes needed to `globals.css` next to the existing `.led` / `.round-face` rules.

## Notes for the implementer
- **Prototype files are reference only.** Never import or copy `support.js` or the `.dc.html` files into `app/` or `public/`. Read `Landing.dc.html` for the exact geometry, copy and gesture timings.
- **Keep the page server-rendered.** `export const dynamic = "force-dynamic"`, `metadata`, the `getSessionUser()` redirect to `/switches` and `signupMode()` stay as they are in the current `app/page.tsx`.
- **Local check is fine for this page.** It is signed out, so `next dev` plus the browser works (unlike login and `/setup`). Check it at 375, 768 and 1280 wide, in Ember and Paper, and in each sign-up mode (`invite`, `open`, `closed`). The mode comes from `SIGNUP_MODE`, but `signupMode()` returns `closed` whenever `RESEND_API_KEY` or `EMAIL_FROM` is unset, so set dummy values for both when testing `invite` and `open` locally.
- **When done:** move this folder to `docs/specs/finished/`, as was done with `design_handoff_lights_map`, and add an entry to `docs/changelog.md`.
