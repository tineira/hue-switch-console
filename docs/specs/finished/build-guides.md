# Build guides: what to buy and how to put it together

Console spec. No device contract change. Process: `AGENTS.md` → "Cross-repo changes" (only the checklist part applies: the Simple firmware repo gets a README link).

**Status:** done

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
- Anchors: `#build`, `#buy`, `#assemble` (Round), `#wire`, `#in-wall` and `#install` (Simple). The landing page links to them.
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

Content, in this order: what you need, what never to do, then the numbered steps. The two explanations ("How an input works", "Do I need resistors?") sit after the steps as reference; the steps link to them.

**Shopping list for B:** XIAO ESP32-C6 (with or without pre-soldered headers; see step 3), switches or buttons (any plain contact: "dry contact", "no light"), hook-up wire, optionally 10 kΩ + 1 kΩ resistors and 10 nF ceramic capacitors (one set per input; 1/4 W or 0603, any tolerance), a box, a USB-C charger.

**Never** (a short, red-bordered list, before the steps):

- connect a pin to anything that is, or was, connected to mains (220 V / 120 V), even "just the switch wires";
- connect a pin to 5 V or any other supply; the pins take 3.3 V at most;
- bring the 3V3 pin out to the wall; it only feeds the pull-up resistors on the board side;
- use illuminated switches (neon or LED pilot light) or smart switches: they have electronics across the contacts, not a plain contact.

**Steps** (`#wire`). Each step has a drawing (or a photo, see open question 5) and one or two sentences. Finish and test one input completely before wiring the next, so a mistake shows up on the first wire, not the sixth.

1. **Set up the board on its own.** Install the firmware, save Wi-Fi, link it and pair the Bridge with nothing wired (links to the Set up steps below). A board that works bare rules out the board.
2. **Test with BOOT.** Give BOOT a job in the console and press it. The light reacts: the whole chain (board, Wi-Fi, Bridge, console) works.
3. **Attach the first wires.** Unplug USB. Solder one wire to **D0** and one to **GND**, or, on a board with headers, use female jumper wires. Drawing of the XIAO's pads with D0 and GND highlighted, matching the silkscreen.
4. **Connect the first switch or button.** One wire to each of its two terminals; which goes where doesn't matter.
5. **Set up the input in the console.** Plug USB back in. On the switch's page, set D0 to "Wall switch" or "Push button" and give it a target.
6. **Test it.** Press or flip it: the light reacts. If it doesn't, the page lists the usual causes (wire on the wrong pad, input not set up, illuminated switch).
7. **Repeat for each input.** D1 to D5, one at a time, testing each. All switches share the one GND: join their GND wires and bring one to the board.
8. **Long wires? Add the resistors and capacitor** (links to "Do I need resistors?"). Per input, on the board side: 10 kΩ from the pin to 3V3, 1 kΩ in series between the pin and the wire, 10 nF from the wire side of the 1 kΩ to GND. A drawing shows the three parts for one input.
9. **Close it up.** Into the box, USB-C charger in, and press every switch once more.

**Reference, after the steps:**

- **How an input works.** Each of D0–D5 reads a contact: the other side of every switch goes to GND. Closed = pressed / on. Pick "Wall switch" (maintained) or "Push button" (momentary) per input in the console. Includes the full wiring diagram: a console copy of `wiring-switches.svg`, redrawn in the site's style (themes, dark mode), with the XIAO pin labels matching the board silkscreen.
- **Do I need resistors?** Answer first, then the reason:
  - **Short wires (on a desk, in a small box, under ~30 cm): no.** The firmware turns on the chip's internal pull-up and ignores bounces shorter than 50 ms. A switch straight between a pin and GND works.
  - **Long wires (metres, or running next to mains cables in a wall): yes**, per input: a **10 kΩ pull-up** from the pin to 3V3, a **1 kΩ resistor in series** between the pin and the wire, and a **10 nF capacitor** from the wire side of the 1 kΩ to GND. These are the values on the carrier board.
  - **What goes wrong without them on long wires:** the internal pull-up is weak (tens of kΩ), so a long wire picks up noise from nearby mains cables and the light switches by itself ("ghost presses"); a static discharge from touching a switch can reach the pin and damage the chip. The 10 kΩ makes the input stiffer, the 1 kΩ limits the current of a spike, the 10 nF shunts fast noise to GND.

#### C. In the wall

The web page is a **"can I use this?"** summary plus the **order of installation**, not the fabrication manual. Fabrication stays in `hue-simple-switch/hardware/README.md` (Gerbers, JLCPCB, soldering, printing), which versions with the board.

1. Big warning first: mains voltage can kill; the design is uncertified; an electrician installs it; circuit off at the breaker.
2. Requirements checklist (`#in-wall`), each a yes/no the reader checks against their box:
   - a **neutral** wire in the box (many Chilean and older homes don't have one; without it this board can't be used);
   - enough depth behind the mechanism (enclosure 46 × 56 × 26 mm), with the box-size table from the hardware README;
   - a plastic box (metal boxes cut Wi-Fi);
   - Hue bulbs that can stay powered all the time.
3. **Before and after diagram** of converting one wall switch (new drawing, the key picture of the whole guide):
   - *Before:* live → wall switch → lamp; the switch cuts the lamp's power.
   - *After:* live joined straight through to the lamp (always on); the carrier board takes L and N; the old switch wires are disconnected from mains **at both ends** and now carry only 3.3 V from the board's D0–D5 and GND terminals to the switch.
4. Photos/renders of the board and enclosure (`hardware/images/`), copied into `public/how-to/`.
5. Getting the board: links to the hardware README sections (order from JLCPCB, solder the XIAO, print the enclosure).
6. **Installation, step by step** (`#install`). Each step says who does it and links to the hardware README section with the detail. Steps 2 to 9 are for the electrician; the page says so above the list.
   1. **Set it up over USB, never on mains.** Install, Wi-Fi, link, pair the Bridge and set up the inputs in the console, before the XIAO is soldered to the board or with J1 disconnected. Unplug USB. From here on, USB is never connected while the board is on mains; updates arrive over Wi-Fi.
   2. **Breaker off, and check it is dead** with a voltage tester, at the box.
   3. **Identify the wires in the box:** permanent live, neutral, the switched live to the lamp, and the wires that run to each switch. No neutral: stop here (requirements).
   4. **Make the lamp permanent.** Join the lamp's switched live to the permanent live with a lever connector (for example WAGO 221). The lamp now stays powered; the Hue Bridge switches it.
   5. **Take the switch wires off mains, at both ends.** Every wire that runs to a switch is disconnected from live, neutral and the lamp, in this box and at the switch. From now on it only connects the switch to the board.
   6. **Wire the switches.** One terminal of each switch to D0–D5 (J2/J3); the other terminals joined with a lever connector and one wire to J3 GND. Solid 1.5 mm² wire goes through a short 0.5–0.75 mm² flexible pigtail on J2/J3.
   7. **Wire mains:** permanent live to J1 L, neutral to J1 N. Earth stays joined to the box's earth wires, not to the board.
   8. **Fit the enclosure** behind (or beside) the mechanism: switch wires through the holes on the low-voltage side, L and N through the two larger ones.
   9. **Check before power:** the electrician confirms that no switch wire touches mains anywhere, with a continuity tester if needed.
   10. **Breaker on and test.** The LED shows it is connected (links to "Reading the LED"); then press or flip each switch and the light reacts.

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

- [x] Landing: the Simple card links to the guide itself (shipped together, so the interim SVG link was skipped)
- [x] Content as data, in `lib/how-to-build.ts` (kept apart from `lib/how-to.ts`); Simple levels A/B/C
- [x] `app/how-to/build-section.tsx`: Build section with anchors, collapsed by default, opened (and scrolled to) by any Build anchor
- [x] `RoundDrawing` gets a `stage` prop (exploded, lined up, assembled); landing page unchanged
- [x] Simple level B: numbered steps 1–9 (3.4), one drawing per step (XIAO pads, one input with R/C, joined GND)
- [x] Simple level C: installation steps 1–10 (3.4), each linking its hardware README section
- [x] New drawings (`app/how-to/build-drawings.tsx`), themed and dark-mode aware: Simple wiring (B, with optional R/C), before/after wall switch conversion (C)
- [x] Board images copied to `public/how-to/`
- [x] Landing links to `#build` / `#assemble` (3.6)
- [x] `docs/changelog.md` entry
- [x] Deployed; checked on production at phone and desktop width, both themes

### Round (`hue-round-switch`)

- [x] README Setup section links to `/how-to?product=round#build`

### Simple (`hue-simple-switch`)

- [x] README wiring paragraph links to `/how-to?product=simple#wire`
- [x] `hardware/README.md` links to `/how-to?product=simple#in-wall` for the "can I use this?" summary
- [x] AGENTS.md: a change to the input R/C values updates the console guide (3.5)

No `FIRMWARE_VERSION` bump: documentation only.

## 5. Open questions

1. **Two-way (staircase, "3-way") switches.** A very common wall setup: two switches control one lamp. A `maintained` channel maps closed → on and open → off, so two such switches on the same room fight: flipping the second one to "closed" when the lamp is already on does nothing. Wiring one of them alone (common + one throw) works as a normal wall switch. Supporting the pair needs a new channel behaviour ("toggle on every change"), which is a cross-repo feature with its own spec. *Recommendation:* the guide says plainly that staircase pairs aren't supported yet and shows the single-switch wiring; open a separate spec for a toggle-on-change kind.
2. **Kits.** Whether to offer the carrier board assembled (or a Round kit) instead of only links to Seeed and the Gerbers. *Recommendation:* not in this spec; links only. Selling mains hardware brings certification and liability questions the project isn't set up for.
3. **Where the Build section opens.** *Recommendation:* collapsed by default, open from `#build` (3.1). Alternative: always open for signed-out visitors, collapsed for signed-in ones (who already own a switch).
4. **Level B enclosure.** Whether to publish a printable box for the USB button box too. *Recommendation:* not now; any project box works, and the guide says so.
5. **Photos or drawings for the level B steps.** Photos of a real button box are clearer for a first build; drawings match the site and never go stale. *Recommendation:* ship with drawings, and swap in photos of the maintainer's own box, step by step, when they exist.

## 6. Outcome

- The Simple guide opens on level B, not A: B's first two steps are A, and a reader who followed a "wiring" link from the landing page wants B.
- The guide says staircase pairs are not supported yet (open question 1); supporting them needs its own cross-repo spec for a toggle-on-change channel kind. Questions 2 (kits), 4 (level B enclosure) and 5 (photos) stay open; the guide ships with drawings.
