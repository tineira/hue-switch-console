# Round card: 3D internals

Companion to `README.md`. This file covers **only** what happens inside the Round card's drawing area: model, render, timeline, overlay, dial and gestures. Page layout, scroll track, progress formula, story column, loading, fallbacks, reduced motion and checks are in `README.md` only. The reference prototype is `Landing v2 prototype.html` in this folder.

## Card
- The card is a header plus the drawing area, nothing else. It never changes size.
- Header left label: "Round · exploded view" while p < 0.6, "Round · assembled" from 0.6, "Round · try it" in Try-it mode. Header right: `mm`, replaced by the live readout in Try-it mode.
- Drawing area: aspect 520:440, full card width, `--cream` fill, `max-height: calc(100svh − 110px)` (58svh on ≤ 860 px). The grid (`--line` every 24 px) sits on its own layer with opacity `1 − tS`.
- `p` comes from the README's progress formula.

## Model
- Copy `buildDisplay`, `buildXiao`, `buildHeaders` and `buildAntenna` from the prototype as they are. Units are mm; each part's root is scaled by 0.001.
- In `buildDisplay` the old `active_area` disc is replaced by `screen`: a `CircleGeometry(16.2, 128)` rotated −90° about X, whose material shows the dial texture.
- Assembly pose (Y offsets in mm, with G = 7):
  - `aTop = 1.8`, `xOff = aTop + G + 4.36`, `xTop = xOff + 0.04`, `xUfl = xOff − 2.45`, `hBase = xTop + G`, `dBase = hBase + 11.5 + G`
  - XIAO: fixed at y = `xOff`, z = 1.5, rotation.z = π (components face down, pads face the display).
  - Headers: y goes from `hBase` to `xTop − 3.0`, z = 1.5.
  - Display: y goes from `dBase` to `xTop + 2.5`.
  - Antenna: rotation.y = π/2, position (−36.3, y, −7.5); y goes from 0 to `xUfl − aTop + 0.2`.
- **The pin headers are drawn but have no balloon.**

## Two renders, cross-faded
Build the assembly twice and keep both copies posed identically every frame.

1. **Line version.**
   - Every mesh uses `MeshBasicMaterial` in `--cream`, with `polygonOffset` factor 1 and units 1.
   - Each mesh gets two children:
     - `LineSegments(EdgesGeometry(geo, 20°))` in `--foreground`.
     - A back-face outline mesh: the prototype's `outlineMat` shader, 1 px thick, in `--foreground`.
   - On Ember (dark) this reads as "Light lines"; on Paper (light) it reads as "Ink".
   - Re-read the CSS variables when the theme toggles.
2. **Shaded version.**
   - The builders' `MeshStandardMaterial`s as they are.
   - `RoomEnvironment` through PMREM (sigma 0.04), environment intensity 0.9.
   - One `DirectionalLight(0xffffff, 1.4)` at (0.3, 1, 0.5).
   - `outputColorSpace = SRGB`.

Both are rendered into two stacked transparent canvases (alpha, clear alpha 0), using one shared `OrthographicCamera`. The shaded canvas has CSS `opacity: tS` and the line canvas has `1 − tS`.

## Timeline
`ss(a, b)` is smoothstep of p between a and b.

| p | What happens |
|---|---|
| 0 – 0.10 | Exploded line drawing, balloons and dashed guides visible |
| 0.10 – 0.40 | Antenna rises to the U.FL jack |
| 0.12 – 0.30 | Balloons fade out |
| 0.22 – 0.50 | Headers drop through the XIAO |
| 0.30 – 0.55 | Dashed guides fade out |
| 0.30 – 0.72 | Line → shaded cross-fade (`tS`) |
| 0.35 – 0.82 | Camera direction eases from (1, 0.78, 1.15) to (0, 1, 0.55), both normalised |
| 0.40 – 0.68 | Display comes down onto the headers |
| 0.55 – 0.90 | Framing narrows from all parts to display + XIAO; the antenna tail may run off the left edge |
| 0.80 – 0.88 | Screen wakes: `emissiveIntensity` goes 0 → 1, showing the **off** dial |
| 0.30 – 0.72 | Grid fades out along with the line canvas |
| ≥ 0.90 | After 700 ms, lights come on (a tap); 450 ms later, Try-it mode starts and the hint appears |
| < 0.86 | Reset: lights off, Try-it closes, pending timers cleared |

**Framing, every frame:**
1. Take the `Box3` of the shaded assembly (blended toward the display + XIAO box by the 0.55–0.90 ramp).
2. Put the camera at `centre + dir × 0.5 m`, up (0, 1, 0), looking at the centre.
3. Transform the 8 box corners into camera space.
4. Fit that extent to the canvas aspect ratio, with padding going from 1.28 to 1.3 over p 0.5–0.85.

Render only when something changes: scroll, resize, theme or dial state.

## Balloons and guides (SVG overlay, not WebGL)
Project each part-local anchor point (mm) to canvas pixels every frame. The balloon sits at anchor + a fixed pixel offset.

| No. | Part | Anchor (local mm) | Offset (px) |
|---|---|---|---|
| 1 | display | (−15.5, 7.3, 9.1) | (−54, −40) |
| 2 | xiao | (−8.9, 0.6, 7.0) | (64, 34) |
| 3 | antenna | (0, 0.2, −23.5) | (0, 58) |

- Balloon style is the same as today: a 28 px circle, 1.5 px `--foreground` stroke, `--cream` fill, Geist Mono 13 px number. The leader line is 1 px `--foreground` with a 2 px dot at the anchor.
- Guides: dashed `5 4`, 1 px `--muted`. They connect:
  - each display socket corner, local (±7.62, 0, 1.5 ± 7.62), to the header pin tops, local (±7.62, 11.5, ±7.62);
  - the header pin tails, local (±7.62, 0, ±7.62), to the XIAO pads, local (∓7.62, 0, ±7.62);
  - the antenna plug, local (0, 1.4, 32.5), to the XIAO U.FL jack, local (3.8, 2.45, −9.0).

## Screen and Try it
- Dial texture: a 1024² canvas drawn with the `.round-dial` geometry scaled from 104. The code is `drawScreen()` in the prototype and matches `RoundScreen` in `switch-bench.tsx`: track, level arc, fill with inner accent ring, Geist Mono name and scene, page dots. Screen material: `MeshStandardMaterial({ color: black, emissive: white, emissiveMap: dialTexture })`.
- Initial state: Living, **off**, level 64, scene Sunset. The auto tap turns it on.
- Room light: the same Room layers as the bench (dark layer plus scene glow, 450 ms opacity), placed behind the canvases inside the drawing area. They show only after the lights come on.
- **Try-it controls, inside the drawing area:** a centred, wrapping row of pill buttons at the bottom (12 px padding, 6 px gap). Each pill: min-height 36, radius 999, 1 px `--line` border, `--cream` fill, Geist Mono 12 px, gesture name in `--foreground` and action in `--muted`; hover border `--filament`, background `--filament-soft`. They fade and rise in over 400 ms. The pills: tap · on / off, double tap · scenes, drag the ring · dim, swipe · next room.
  - In Try-it mode the camera frame shifts down by `0.14 × halfHeight`, so the screen sits above the pills.
- **Card header in Try-it mode:** the left label reads "Round · try it", and the right label ("mm") is replaced by the readout `→ {page} · {scene} · {level}%` or `→ {page} · off`, with `aria-live="polite"`.
- **"It's live" hint**, shown when Try-it starts and removed for good after the first gesture (screen or pill):
  - Two `--filament` 2 px rings on the projected screen outline, scaling 1 → 1.35 while fading out, 1.8 s, staggered by 0.9 s.
  - A pill above the screen: `--filament` background, `--filament-ink` text, Geist Mono 12 px, radius 999. Text: "Touch the screen · it works".
  - Project the screen centre and its rim point (16.2, 0, 0) every frame to position both.
- **Pointer gestures on the canvas, Try-it mode only:**
  - Raycast against the `screen` mesh. Its UV gives `dx = u − 0.5`, `dy = 0.5 − v`.
  - A press at `hypot > 0.31` grabs the ring; otherwise tap, double tap (240 ms window) and swipe (> 30 px) work exactly as in `RoundScreen`.
  - Pointer events come from the screen-sized hit element described in README "Touch on phones"; the drawing area itself stays `touch-action: pan-y`.
- Page themes: Living ember, Kitchen ocean, Bedroom violet, all from `ROUND_THEMES`.
