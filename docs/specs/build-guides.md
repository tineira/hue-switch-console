# Build guides: what to buy and how to put it together

Console spec. No device contract change. Process: `AGENTS.md` → "Cross-repo changes" (only the checklist part applies: the Simple firmware repo gets a README link).

**Status:** draft

## 1. What and why

Today `/how-to` starts after the hardware exists: plug in, install, pair. Nothing on the site says what to buy, how the Round goes together, or how the Simple is wired to a wall switch. The landing page's Simple card even promises "The setup guide shows the wiring" (`app/page.tsx`), and the guide doesn't.

Most of the material already exists, out of sight, in `hue-simple-switch`: `docs/wiring-switches.svg` and `hardware/README.md` (mains carrier board, BOM, JLCPCB order, printable enclosure, neutral requirement, box sizes, safety). Nobody coming from the website finds it.

Afterwards, someone who has never seen the project can open `/how-to`, pick Round or Simple, and learn:

- exactly what to buy (with links), and what they probably already have;
- how to assemble it (Round) or which of three ways to build it (Simple);
- for the Simple: whether they need resistors and capacitors, what happens if they wire a switch straight to the pins, what they must never connect, and how a wall switch is converted.

## 2. Contract change

None. No endpoint, payload, NVS key or installer change.

## 3. Design

### 3.1 Where it goes

A **Build** section at the top of each product's `/how-to`, before "Set up a …". The flow is linear (buy → build → set up), so it stays one page, one URL per product (`/how-to?product=…`), and search keeps one page per product.

- The section starts collapsed to a one-line summary with a "Show" control for people who already have a built switch, and opens by default when the visitor arrives from the landing page (link with `#build`).
- Anchors: `#build`, `#buy`, `#assemble` (Round), `#wire` (Simple), `#in-wall` (Simple). The landing page links to them.
- Content lives in `lib/how-to.ts` next to `setupSteps()`, as data (`buildSteps(product)`, `shoppingList(product)`), rendered by `how-to-guide.tsx` with the same step layout and `Rich` text as the setup steps.

### 3.2 Shopping list (both products)

A table per product: part, why, link, "you may already have it". Links go to the vendor (Seeed), no affiliate links, no prices (they go stale).

**Round**

| Part | Note |
| --- | --- |
| Seeed Round Display for XIAO | The screen and its board |
| Seeed XIAO ESP32-S3 | The plain S3. Must be an S3: the C3/C6 do not run the Round firmware. The "Sense" (camera) variant is untested; the guide says so |
| 2.4 GHz antenna | Ships with the XIAO. Without it, "No Wi-Fi" |
| USB-C cable **with data** | Charge-only cables are the most common reason setup fails |
| USB-C power supply | Any 5 V phone charger, for the switch's final place |

**Simple**: the list depends on the build level (3.4); each level shows its own list.

The existing `NEEDS` list ("The switch", "A USB-C data cable", …) stays under Set up.

### 3.3 Round: assemble

Three steps, each with a drawing and one or two sentences:

1. Plug the antenna into the XIAO's U.FL connector (press straight down until it clicks; it only lies flat one way).
2. Line the XIAO up with the sockets on the back of the Round Display, turned as in the drawing. (Confirm the orientation against a real board and Seeed's wiki before writing the sentence.)
3. Press it home. No soldering.

Drawings: reuse `RoundDrawing` from `app/landing/parts-drawings.tsx` (the landing page's static isometric fallback), extended with a `stage` prop that draws the exploded, lined-up and assembled positions. Static SVG, not the WebGL scene: it prints, loads on any phone, and needs no scroll track. Shared code, so the landing page and the guide never disagree about the parts.

### 3.4 Simple: three build levels

Shown as three cards the reader picks from, each opening its own steps and shopping list:

| Level | Needs | For |
| --- | --- | --- |
| **A. Try it** | The XIAO ESP32-C6 and a USB-C cable. Nothing else | Everyone, first. The BOOT button is a working push button |
| **B. Button box on USB-C** | XIAO, switches or push buttons, wire. Resistors and capacitors recommended past short wires | Makers; low voltage only, no mains anywhere |
| **C. In the wall** | The mains carrier board and printed enclosure from `hue-simple-switch/hardware/` | Experienced makers, **installed by an electrician** |

#### A. Try it

No wiring. Set up the board (existing steps), give BOOT a job, press it. Explains that BOOT's hold re-pairs unless it has a hold recipe (existing text in `tasks()`).

#### B. Button box on USB-C

Content, in this order:

1. **How an input works.** Each of D0–D5 reads a contact: the other side of every switch goes to GND. Closed = pressed / on. Pick "Wall switch" (maintained) or "Push button" (momentary) per input in the console.
2. **Wiring diagram.** A console copy of `wiring-switches.svg`, redrawn in the site's style (themes, dark mode), with the XIAO pin labels matching the board silkscreen.
3. **Do I need resistors?** Answer first, then the reason:
   - **Short wires (on a desk, in a small box, under ~30 cm): no.** The firmware turns on the chip's internal pull-up and ignores bounces shorter than 50 ms. A switch straight between a pin and GND works.
   - **Long wires (metres, or running next to mains cables in a wall): yes**, per input: a **10 kΩ pull-up** from the pin to 3V3, a **1 kΩ resistor in series** between the pin and the wire, and a **10 nF capacitor** from the wire's end to GND. These are the values on the carrier board.
   - **What goes wrong without them on long wires:** the internal pull-up is weak (tens of kΩ), so a long wire picks up noise from nearby mains cables and the light switches by itself ("ghost presses"); a static discharge from touching a switch can reach the pin and damage the chip. The 10 kΩ makes the input stiffer, the 1 kΩ limits the current of a spike, the 10 nF shunts fast noise to GND.
4. **Never** (a short, red-bordered list):
   - connect a pin to anything that is, or was, connected to mains (220 V / 120 V), even "just the switch wires";
   - connect a pin to 5 V or any other supply; the pins take 3.3 V at most;
   - bring the 3V3 pin out to the wall; it only feeds the pull-up resistors on the board side;
   - use illuminated switches (neon or LED pilot light) or smart switches: they have electronics across the contacts, not a plain contact.
5. **Shopping list for B:** XIAO ESP32-C6, switches or buttons (any plain contact: "dry contact", "no light"), hook-up wire, optionally 10 kΩ + 1 kΩ resistors and 10 nF ceramic capacitors (one set per input; 1/4 W or 0603, any tolerance), a box, a USB-C charger.

#### C. In the wall

The web page is a **"can I use this?"** summary, not the full build manual. The fabrication manual stays in `hue-simple-switch/hardware/README.md` (Gerbers, JLCPCB, soldering, printing), which versions with the board.

1. Big warning first: mains voltage can kill; the design is uncertified; an electrician installs it; circuit off at the breaker.
2. Requirements checklist, each a yes/no the reader checks against their box:
   - a **neutral** wire in the box (many Chilean and older homes don't have one; without it this board can't be used);
   - enough depth behind the mechanism (enclosure 46 × 56 × 26 mm), with the box-size table from the hardware README;
   - a plastic box (metal boxes cut Wi-Fi);
   - Hue bulbs that can stay powered all the time.
3. **Before and after diagram** of converting one wall switch (new drawing, the key picture of the whole guide):
   - *Before:* live → wall switch → lamp; the switch cuts the lamp's power.
   - *After:* live joined straight through to the lamp (always on); the carrier board takes L and N; the old switch wires are disconnected from mains **at both ends** and now carry only 3.3 V from the board's D0–D5 and GND terminals to the switch.
4. Photos/renders of the board and enclosure (`hardware/images/`), copied into `public/how-to/`.
5. Links to the hardware README sections: order from JLCPCB, solder the XIAO, print the enclosure, wire it.
6. Set it up over USB **before** it goes on mains; never connect USB while it is on mains; updates arrive over Wi-Fi afterwards.

### 3.5 Source of truth

- The **console** owns the user-facing guide (what to buy, levels, "do I need resistors", never-list, conversion diagram).
- **`hue-simple-switch/hardware/README.md`** owns fabrication (Gerbers, BOM, CPL, JLCPCB, soldering, printing) and the electrical design. The guide links there and does not copy its steps.
- `hue-simple-switch/README.md` links to the guide (`/how-to?product=simple#build`) for wiring, and the console SVG replaces `docs/wiring-switches.svg` as the one people are sent to. The firmware repo keeps its SVG for people reading the repo.
- Resistor and capacitor values in the guide must match the carrier board's (R1–R6, R11–R16, C11–C16). If the board changes, the firmware session updates the guide in the same change (checklist item below).

### 3.6 Landing page

- Now, before the guide exists: the Simple card's "The setup guide shows the wiring" links to the firmware repo's wiring SVG instead of promising the guide.
- With the guide: the Simple card links to `/how-to?product=simple#build`, and the Round parts list gets a "How it goes together" link to `/how-to?product=round#assemble`.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Landing: Simple card wiring sentence links to the existing wiring SVG (immediate fix, 3.6)
- [ ] `lib/how-to.ts`: `shoppingList(product)` and `buildSteps(product)` data; Simple levels A/B/C
- [ ] `how-to-guide.tsx`: Build section with anchors, collapsed by default, open from `#build`
- [ ] `RoundDrawing` gets a `stage` prop (exploded, lined up, assembled); landing page unchanged
- [ ] New drawings, themed and dark-mode aware: Simple wiring (B, with optional R/C), before/after wall switch conversion (C)
- [ ] Board and enclosure images copied to `public/how-to/`
- [ ] Landing links to `#build` / `#assemble` (3.6)
- [ ] `docs/changelog.md` entry
- [ ] Deployed; checked on production at phone and desktop width, both themes

### Round (`hue-round-switch`)

- [ ] README "What you need" links to `/how-to?product=round#build`

### Simple (`hue-simple-switch`)

- [ ] README wiring paragraph links to `/how-to?product=simple#wire`
- [ ] `hardware/README.md` links to `/how-to?product=simple#in-wall` for the "can I use this?" summary
- [ ] AGENTS.md: a change to the input R/C values updates the console guide (3.5)

No `FIRMWARE_VERSION` bump: documentation only.

## 5. Open questions

1. **Two-way (staircase, "3-way") switches.** A very common wall setup: two switches control one lamp. A `maintained` channel maps closed → on and open → off, so two such switches on the same room fight: flipping the second one to "closed" when the lamp is already on does nothing. Wiring one of them alone (common + one throw) works as a normal wall switch. Supporting the pair needs a new channel behaviour ("toggle on every change"), which is a cross-repo feature with its own spec. *Recommendation:* the guide says plainly that staircase pairs aren't supported yet and shows the single-switch wiring; open a separate spec for a toggle-on-change kind.
2. **Kits.** Whether to offer the carrier board assembled (or a Round kit) instead of only links to Seeed and the Gerbers. *Recommendation:* not in this spec; links only. Selling mains hardware brings certification and liability questions the project isn't set up for.
3. **Where the Build section opens.** *Recommendation:* collapsed by default, open from `#build` (3.1). Alternative: always open for signed-out visitors, collapsed for signed-in ones (who already own a switch).
4. **Level B enclosure.** Whether to publish a printable box for the USB button box too. *Recommendation:* not now; any project box works, and the guide says so.
