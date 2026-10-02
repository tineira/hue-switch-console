# Handoff: signed-out landing page v2 (hue.tineira.com)

Repo: `tineira/hue-switch-console` (Next.js 16 App Router, Tailwind v4, tokens in `app/globals.css`).

**Ahead of firmware:** the Simple card advertises 7 inputs (BOOT + D0–D5). Today `docs/definitions.md` defines the Simple's channels as `boot` / `d0` / `d1` / `d2`. The owner is writing a separate cross-repo spec that adds `d3`–`d5`. Shipping this page before that change is live is the owner's call; don't hold the page back for it.

This page makes no contract, firmware or data change itself. It is a console-only UI handoff like `docs/specs/finished/design_handoff_landing_page`, so it does not follow `docs/specs/TEMPLATE.md`.

## Files in this folder
- `Landing v2 prototype.html`: the full page as a working prototype. Open it in Chrome; it needs no build step (three.js loads from unpkg). **It's a reference, not code to copy.** Rebuild it in the repo's own patterns. The inline `<script type="module">` holds every constant, timing and geometry value.
- `round-assembly.md`: the Round card's 3D internals only (model, poses, timeline, line → shaded cross-fade, overlay, dial texture, Try-it gestures). It does not repeat anything in this README, and nothing in the two files overlaps.

## Page order (replaces the current `app/page.tsx` layout)
1. Header: logo + "Hue Switch Console", theme toggle, Sign in. Unchanged.
2. **Hero + Round story** (one scroll track). See below.
3. **Simple card**: parts list and try-it demo on the left, 3D line drawing on the right.
4. Trust strip. Copy unchanged; the "Open source" item now ends with a link.
5. "From USB to wall in three steps". Unchanged; keep using `StateVisual`. The prototype's circle faces are stand-ins.
6. Closing band.
7. Trademark line.
8. `SiteFooter`. Unchanged.

Removed from the current page:
- the hero's "Try them" bench (`SwitchBench`);
- the "What you need" heading and its sub-line;
- the old static `RoundDrawing` and `SimpleDrawing` (keep `RoundDrawing` as the no-WebGL fallback).

## 2. Hero + Round story
- One `section#track`, max-width 1200, laid out as a grid `minmax(0,1fr) minmax(0,1.25fr)` with a `clamp(28px,4vw,56px)` gap.
- **Left column**, top to bottom:
  - **Hero**, `min-height: calc(100svh − 60px)`, vertically centred. Eyebrow, H1, lead, the two buttons and the account line. Copy and sign-up-mode logic are unchanged from the current page (`signupMode()`).
  - **Story wrap**, `height: 340svh`, containing a `position: sticky; top: 0; height: 100svh` story block:
    - eyebrow "Round · 3 parts";
    - H3 "A touch screen that snaps onto a XIAO.";
    - an `<ol>` in build order: 1 XIAO ESP32-S3, 2 2.4 GHz antenna, 3 Round Display (current copy and links), plus a 4th row "→ Try it: Tap, double tap, drag the ring or swipe, right on the screen." Hide this row, and the phone caption's last line, when WebGL is unavailable.
- **Right column**: one sticky (`top: 0; height: 100svh`) wrapper holding the Round card. It stays pinned from the very top of the page, so visitors first see it beside the hero.
- **Progress:**
  ```
  start = narrow ? heroH : heroH * 0.5
  len   = (track.height − stickyH − start) * 0.7
  p     = clamp((−track.top − start) / len, 0, 1)
  ```
  `stickyH` is the measured height of the sticky wrapper (100svh), **not** `innerHeight`, which changes as a phone's address bar shows and hides and would make `p` wobble. The assembly starts once the hero is half scrolled away. The last 30% of the track holds the live screen still.
- **Story highlighting.** The active row gets a 1.5 px `--filament` ring around its number. **Part rows never fade.** Only the "Try it" row sits at opacity .38 until Try-it mode starts.
  | p | Active row |
  |---|---|
  | < 0.08 | none |
  | 0.08 – 0.30 | 1 |
  | 0.30 – 0.48 | 2 |
  | 0.48 – 0.78 | 3 |
  | 0.78 → Try-it | Put it together (on phones, which have no such row: 1, 2 and 3) |
  | Try-it mode | Try it |
- **Scroll hint:** a pill at the bottom of the drawing area reading "Scroll to put it together ↓" (mono 11 px, uppercase, `--muted` on `--cream`, 1 px `--line` border). Shown while p < 0.02 and hidden under reduced motion.
- **≤ 860 px:**
  - One column: hero first (`padding: 56px 0 40px`, no min-height), then the card column, which pins at the top once you scroll past the hero.
  - The story wrap is hidden, and the card column gets `height: 220svh` instead (shorter than desktop so phone visitors reach the Simple card sooner; the animation still uses 70% of it).
  - Drawing area `max-height: 58svh`.
  - **The parts list still shows.** Render the same Round `<ol>` (the three parts with sizes and Seeed links; no "Try it" row) **below the pinned track**, unpinned, styled like the Simple card's list, with a "Round · 3 parts" header. The collapsed layouts (reduced motion, no WebGL) use this same list on phones.
  - A one-line caption under the pinned card follows the steps: "Scroll to put it together", "1 · Pin headers go through the XIAO", "2 · Antenna clicks into the U.FL jack", "3 · Round Display comes down onto the pins", "Screen wakes up…", "→ Try it: touch the screen".

## 3. Simple card
- One card, grid `minmax(0,1fr) minmax(0,1.25fr)`, 1 px `--line` divider between the columns. On ≤ 860 px it stacks with the drawing first.
- **Left column:**
  - Header "Simple · 1 part".
  - Parts `<ol>`:
    1. **XIAO ESP32-C6** (link). "21 × 17.5 mm. Up to seven wall switches or push buttons: D0 to D5, plus the BOOT button on the board."
    2. **The switches already in your wall.** "Toggle switches or push buttons, plus a few wires. The setup guide shows the wiring."
  - Header "Simple · try it", with the readout `→ Hallway · {scene · }{level}%` or `→ Hallway · off` on the right (`aria-live`).
  - The room tile with the wall plate and status LED. This is the existing `WallPlate` + `Room` from `switch-bench.tsx`: same behaviour and timings, 236 px tall, 18 px side margin.
  - Pill buttons (same style as the Round pills): click · on / off, double-click · scenes, hold · dim.
- **Right column:**
  - Header "Simple" / "mm".
  - Grid background. The drawing is centred vertically, 520 × 440 scaled to the column width.
- **The drawing is three.js**, from the same `buildXiao()` + `buildHeaders()` used for the Round:
  - Headers flipped under the board (`rotation.x = π`, y = 3 mm).
  - Line style only: `--cream` fill, 20° crease edges and 1 px silhouette in `--foreground`. Re-render on theme change.
  - Orthographic camera, direction (0.8, 2.2, −1) normalised, fitted to the board's box with padding 2.25 (horizontal) and 1.5 (vertical).
  - Render once; re-render on resize and theme change. No animation.
  - It can share the Round's three.js chunk, and loads only when near the viewport.
- **Overlay (SVG), positions projected from XIAO-local mm (board top y = 1.25):**
  - **Input pads:** D0–D5 = local (7.62, T, z) for z = 7.62, 5.08, 2.54, 0, −2.54, −5.08. Each gets a filled `--filament` dot, r 3.2. No per-pin tags.
  - **USB-C silhouette:** a 1.5 px `--foreground` polygon, the convex hull of the projected `usb_c` vertices. Its curved sides have no crease edges, so without this it reads faintly.
  - **Status LED:** at local (−5.3, T + 1.2, 4.8), a `#ff8a1f` dot with a glow.
  - **Callouts** on two columns just outside the board's projected bounds. Each label sits on an 18 px horizontal shelf, with one straight leader and a 2 px dot at its part:
    - left: "D0–D5 · 1–6" → the midpoint of the D2/D3 pads;
    - right, top to bottom, so the leaders don't cross: "BOOT · 7" → local (−5.2, T + 0.5, 8.9), then "Status LED".
  - **Balloon "1":** same style as the Round (28 px, 1.5 px stroke, `--cream` fill, mono 13). It sits on the right column below "Status LED", with a leader to the metal cover at local (1.5, T + 1.9, −1.0).
  - **No dimension lines.**
- **Board body: owner's decision, keep as is.** The model is our ESP32-S3 body (17.8 mm wide, S3 shield and U.FL) labelled as the C6; it's an illustration, not a technical drawing. The BOOT and status-LED positions were set by the owner on this drawing, and the D0–D5 side follows the standard XIAO pinout. The pin headers under the board also stay (owner's decision).

## Touch on phones
The drawing area keeps `touch-action: pan-y` at all times, so a finger anywhere on the card scrolls the page. In Try-it mode, an extra absolutely-positioned element sized and placed to the **projected screen circle** (same projection as the hint rings) gets `touch-action: none` and receives the Round's pointer gestures. `touch-action` is read when a touch starts, so this must be a separate element, not a class toggled on the drawing area. Reposition it on every render. Mouse users get the same hit area.

Call `setPointerCapture(e.pointerId)` on that element in `pointerdown`, so a ring drag or swipe that slides off the circle keeps receiving `pointermove`/`pointerup` until it ends.

## Viewport units
Use `svh` everywhere the prototype uses `vh` (hero min-height, sticky heights, track heights, max-heights), so sticky blocks don't jump when a phone's address bar shows or hides.

## 4 / 6. Open-source links
Repo URL: `https://github.com/tineira/hue-switch-console`. Open it in a new tab with `rel="noopener noreferrer"`.
- **Trust strip "Open source":** the text now ends "Read it, fork it, host your own ↗", as a link.
- **Closing band:** keep each sign-up mode's title and text exactly as `app/page.tsx` has them today, for all four modes (`waitlist`, `invite`, `open`, `closed`). Only two things change:
  - Wherever a mode's text says "open source" (today: the `waitlist` text, "…The console is open source, so you can also host your own…"), those two words become the repo link. Other modes' text is unchanged.
  - Actions, in every mode: primary (the mode's label and link, as today), secondary "Source on GitHub ↗", then the Privacy link. "Sign in" is dropped here because the header already has it. In `closed` mode, where the primary is already "Read the setup guide", keep that and still add the GitHub button.

## Loading, fallbacks and graphics budget
- three.js loads with one dynamic `import()`, shared by both cards.
- **Round first paint:** until the first WebGL frame renders, show a pre-rendered image, not the CSS drawing, so the swap doesn't visibly jump. Swap it for the canvases once frame one is drawn.
  - Default: the **first frame** (exploded line drawing). Under reduced motion: the **finished frame** (assembled, shaded, dial on), since that's what those visitors see next.
  - Show it with `object-fit: contain`, centred, filling the drawing area, the same way the camera fits its box. The area stops being exactly 520:440 when `max-height` kicks in, so a stretched or top-aligned image would shift at the swap.
  - One image per theme per state (4 files) in `public/landing/round-{first|final}-{ember|paper}.png`, exported from the prototype at 2× the card's max size. **Re-export them whenever the model, camera or timeline changes.**
- **Simple card:** don't keep a live renderer. When it comes within about one viewport, render it once (and again on resize or theme change) into an `<img>`, then dispose the renderer. Better still, reuse the Round's line renderer for that one-off render. Only the Round keeps live renderers: two canvases, one PMREM.
  - Call `toDataURL` in the same task as `render()` (or create that renderer with `preserveDrawingBuffer: true`); otherwise the image comes back blank.
  - Compute the SVG overlay's projected points (pads, USB-C hull, callouts, balloon) during that same render, before the renderer and camera are disposed. Recompute them on every re-render.
- **Track height collapses** whenever the scrub is off, so nobody scrolls through empty space:
  - `prefers-reduced-motion: reduce`: the story wrap and the phone card column drop to auto height, nothing is sticky, and the Round shows its finished, lights-on, Try-it state (pills and readout live, no room fades, no LED blinking). The hint pill ("Touch the screen · it works") shows; the hint rings don't show at all.
  - No WebGL: the same collapsed layout, the static CSS drawing in the card, the parts list plain and unpinned (on desktop the story column's list; on ≤ 860 px the list below the track), and no Try-it pills.
- Cap `devicePixelRatio` at 2. Render only when something changes: scroll, resize, theme or state. Dispose renderers on unmount.

## Check
- 375, 768 and 1280 wide × Ember and Paper × sign-up modes `waitlist`, `invite`, `open` and `closed`.
- At 375 wide, scroll the whole page: the pinned Round should not feel longer than about two screens, and the Simple card should follow soon after.
- Reduced motion and WebGL disabled (Chrome flag): no empty scroll space, and the Round's parts list reads normally.
- Scroll down and back up: the Round takes itself apart and turns off cleanly.
- Keyboard: the pills are buttons with visible focus, and the drawings are `aria-hidden`.
- Network: three.js does not block first paint.
- Add a `docs/changelog.md` entry. Move this folder to `docs/specs/finished/` when done.
