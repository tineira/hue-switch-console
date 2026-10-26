# Handoff: Lights page v2, the map (`/bridges/[bridgeid]/lights`)

This replaces `design_handoff_lights_page/` (the flat "By room / By switch" version). Build only this one.

## Files
- `Lights map desktop.dc.html`: the desktop design (≥ 1024px)
- `Lights map mobile.dc.html`: the mobile design (< 1024px), shown in a 390px phone frame
- `support.js`: the runtime the prototypes need (not for production)

Open the HTML files in a browser with `support.js` next to them.
- The logic at the bottom of each file (`build()`, `reach()`, `marks()`, `lightMarks`, `groupDetail`, `lightDetail`, `lines()`, the phrase helpers) is the reference for the rules below. Port it.
- The data comes from the real snapshot.
- Tweaks: **house** (This house / Small house / No switches / Empty bridge) and **stale** (adds a gesture pointing at a missing target).

## Fidelity
High fidelity.
- Use only the CSS variables in `globals.css`: `--background --foreground --cream --muted --line --filament --filament-soft --warn --warn-soft`.
- Fonts: Geist and Geist Mono.
- Radii: 6 / 10 / 12 / full.
- Must work in all 17 themes.
- Keep the production Shell, nav, **theme picker** and account menu unchanged. The mobile prototype has no theme picker, but production keeps its own.

## Core model (both layouts)
- **Groups** are rooms and zones. A light belongs to exactly one room and to 0 or more zones.
- **Lighting acts** are `toggle`, `dim`, `scenes`, `onoff`, `on` and `off`. `none` and `repair` are ignored.
- **Direct**: a gesture whose target is this light, or a list of lights that includes it.
- **Via group**: a gesture that targets a room or zone containing the light.
- **Status**: `direct`, otherwise `via`, otherwise `none`.
- **Stale target**: its id isn't in the snapshot. It shows in the warn banner with a "Fix in Switches" link.

### Switch colours
Each switch gets a colour from its index in the switch list:
- Colour: `oklch(L C H)`, with `H = [250,145,330,75,195,20,285,110][i % 8]`.
- Dark themes: `L=.76 C=.13`. Light themes: `L=.56 C=.15`.

### Marks (what shows next to a room, zone or light)
- **Room or zone**: one mark per switch that controls it as a whole (any lighting act, including scenes).
- **Light**:
  - A **filled dot** for each switch that controls it directly.
  - A **ring** (1.5px border in the switch colour) for each switch that reaches it through a room or zone with a non-scene act, and doesn't control it directly.
  - A muted grey ring if the only route is scenes through a group.
  - A `No switch` warn pill if nothing reaches it.
- **Switches with named inputs** (Round pages have `title`) show as a **chip** per page instead of a dot:
  - Colour-mix 22% of the switch colour, 1px border in the switch colour, foreground text, 11/500, rounded-full.
  - Example: "Cocina", "Veladores".
  - Simple switches (BOOT / D0…) always show as dots.
- **Rings stay rings** even for Round (no chips), so a zone with every light doesn't put a chip on 44 rows.
- **Scene chips** in details: scenes in a switch's cycle show a muted border plus a 7px dot per switch that cycles them, and are sorted first.
- **Detail lines** start with the switch's dot. Gestures are grouped by switch and context into one line, e.g. "Round Display 1 · page Bano · Tap toggles · Double tap cycles Relax → Tina → Read · Ring dims".

## Desktop layout
Shell wide (max 1280, padding 32/20).
1. **Header**:
   - "Lights" (24/600).
   - Meta line: bridge id (mono), then counts, then the snapshot time.
2. **Stale banner, no-switches notice and empty state**: as in the file.
3. **Toolbar**:
   - Search (max 320).
   - Label "SWITCHES", then one **switch chip** per switch: a 10px colour dot plus the name.
   - There are no status filter chips.
4. **Map**, three columns: `minmax(0,1fr) 120px 320px`.
   - **Rooms + lights column**: one card per room, grid `250px | 1fr`.
     - The left side is the room: name, `N lights · N scenes`, marks or "No switch of its own".
     - A 1px divider separates it from the right side: the room's light rows (min-height 30, name plus marks).
     - There is no connector between a room and its lights.
   - **Gap column** (120px) is where the connectors are drawn.
   - **Zones column**: sticky (top 16, max-height 100vh-32, scrolls on its own). Each zone card shows the name, the light count in mono ("all 44" for every-light zones) and marks.
   - **Connectors**: an SVG overlay with cubic curves from the right edge of a light row to the left edge of a zone card. Stroke is filament 1.5px with a 3px dot at each end. Recompute them on scroll, resize, zone-column scroll and every update.

### Desktop interaction
- **Hover a light**: connectors to each of its zones. Its room and zones highlight, the rest dims (opacity .35–.4).
- **Hover a zone**: connectors from each of its lights. The opacity is .45 when the zone has more than 20 lights, otherwise .8. Its lights and their rooms highlight.
- **Hover a room**: its lights highlight, plus connectors from those lights to every zone that shares them.
- **Click a light, room or zone**: it opens **in place** (the card expands) and stays pinned, with its connectors kept.
  - The expanded content shows who controls it (Direct / Through a room or zone / Whole room / Also through zones), scenes and facts.
  - Click it again, press Esc or click empty map space to close.
- **Switch chips**:
  - **Hover** previews the switch's reach. **Click** pins it; click again or press Esc to clear.
  - **Reach** means every light it controls directly or through a group, plus their rooms. Groups it controls as a whole are strongly highlighted, and everything else dims.
  - **Selecting a switch draws no connectors.** Hovering a zone, light or room while a switch is selected draws that node's connectors.
- **Reverse direction**:
  - Hovering or opening a **light** lights up the chips of every switch that reaches it.
  - Hovering or opening a **room or zone** lights up only the chips of switches that control it **as a whole**.
  - Other chips dim to .45.
- **Legend** under the map: filled dots, rings, a "Page" chip (only when a switch has named inputs), the grey ring and "No switch". Hint text: "Hover to preview · click to open · Esc to close · hover or click a switch to see its reach".

## Mobile layout
- No connectors and no columns. Touch targets are at least 44px, and inputs use a 16px font.
1. **Header**: app name, menu, "Lights" (28/600), the bridge id and counts.
2. **Sticky block** (background colour, bottom border), containing:
   - Search at 44px height.
   - Switch chips in a sideways-scrolling row (40px, dot plus name). Tap to filter.
   - When filtered, a line "X reaches N lights in M rooms" with "Show all".
   - A **Rooms · N | Zones · N** segmented control.
3. **Rooms tab**: stacked room cards.
   - Header button: name, meta, marks, chevron.
   - Below it, the light rows (44px, name plus marks).
   - While filtered, only rooms the switch reaches show. Lights it reaches get filament-soft, the others .4.
4. **Zones tab**: zone cards with name, mono count and marks.
   - While filtered, zones the switch controls as a whole get a filament border and soft fill.
   - Zones it only partly reaches say "N of M lights reached".
5. **Bottom sheet** (82% max height, 22px top radius, grab handle, dim overlay; tap the overlay or × to close):
   - **Light**: title, kind line (Colour or White · On or Off at snapshot), marks.
     - Tappable **Room** and **Zones** chips that navigate within the sheet.
     - Direct and "Through a room or zone" lines.
   - **Room or zone**: marks, "Whole room/zone" lines, "Also through zones" (rooms only), scenes with dots.
     - Lights: a flat list for a room, grouped by room for a zone ("All of Cocina" / "1 of 4 in Hall Acceso"). Each light is tappable.
   - Sheets stack; show a back arrow when there is more than one.
6. **Legend** card at the end of the list.

## Search (both layouts)
A case-insensitive substring match.
- **Rooms** show if their name or any of their lights match. When the room name matches, all its lights show.
- **Zones** show if their name or a member light matches.
- **Desktop** dims non-matches. **Mobile** hides them.

## Data
- Use the existing snapshot and each switch's pages or channels with their recipes.
- Compute everything on the client. There is no new API.
