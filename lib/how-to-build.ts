// Copy for the Build part of /how-to: what to buy and how to put each switch together
// (docs/specs/finished/build-guides.md). **label** marks a UI label or key term, as in lib/how-to.ts.
//
// The resistor and capacitor values must match the mains carrier board's input circuit
// (R1–R6, R11–R16, C11–C16 in hue-simple-switch/hardware/). Change both together.

import type { Product } from "@/lib/how-to";

/** Build-guide illustrations, rendered from the 3D models (app/how-to/illo/scenes.ts). */
export type IlloId =
  | "round-kit"
  | "round-headers"
  | "round-antenna"
  | "round-dip"
  | "round-below"
  | "round-switch"
  | "round-done"
  | "simple-kit-try"
  | "simple-plug"
  | "simple-led"
  | "simple-boot"
  | "simple-kit-box"
  | "simple-wires"
  | "simple-switch"
  | "simple-test"
  | "simple-all"
  | "simple-rc"
  | "simple-rc3"
  | "simple-box"
  | "wall-board"
  | "wall-usb"
  | "wall-breaker"
  | "wall-before"
  | "wall-identify"
  | "wall-lamp"
  | "wall-offmains"
  | "wall-switches"
  | "wall-mains"
  | "wall-check"
  | "wall-fit"
  | "wall-after"
  | "wall-on";

/** A step's picture: a render, or the real Switches editor in a given state. `alt` describes it. */
export type Pic = ({ illo: IlloId } | { editor: "boot" | "add" }) & { alt: string };

export const HARDWARE_README = "https://github.com/tineira/hue-simple-switch/blob/main/hardware/README.md";

// Anchors inside the Build section. Any of them in the URL opens it.

export type BuyItem = {
  name: string;
  why: string;
  href?: string;
  // "You may already have it": a cable, a charger, wire.
  have?: boolean;
  /** Its part balloon in the picture above the list; rows not drawn there have none. */
  pic?: number;
  optional?: boolean;
};

export const ROUND_BUY: BuyItem[] = [
  {
    name: "Seeed Round Display for XIAO",
    pic: 1,
    why: "The 1.28″ round touch screen and its board. The XIAO plugs into the sockets on its back.",
    href: "https://www.seeedstudio.com/Seeed-Studio-Round-Display-for-XIAO-p-5638.html",
  },
  {
    name: "Seeed XIAO ESP32-S3",
    pic: 2,
    why: "The plain S3. It must be an S3: the C3 and C6 don't run the Round firmware. The S3 **Sense** (with camera) fits the display but hasn't been tested with this firmware.",
    href: "https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html",
  },
  {
    name: "Pin headers",
    pic: 3,
    why: "Two strips of 7 pins. Seeed sells the XIAO with them **loose in the bag** or **already soldered**. Loose ones have to be soldered on (step 1); pick the pre-soldered XIAO to skip that.",
  },
  {
    name: "2.4 GHz antenna",
    pic: 4,
    why: "Comes in the XIAO's bag. Without it the screen says **No Wi-Fi**.",
  },
  {
    name: "USB-C cable that carries data",
    why: "For the install. Charge-only cables are the most common reason the board never shows up on Setup.",
    have: true,
  },
  {
    name: "USB-C phone charger",
    why: "Any 5 V charger, to power the switch where it lives.",
    have: true,
  },
  {
    name: "Soldering iron and solder",
    why: "Only for loose headers. A fine tip and a few minutes.",
    have: true,
    optional: true,
  },
];

export const ROUND_KIT: Pic = {
  illo: "round-kit",
  alt: "The parts, numbered 1 to 4 like the list below: the Round Display with its screen off, the XIAO ESP32-S3, two pin header strips and the flat antenna on its thin cable.",
};

export type AssembleStep = { title: string; body: string; pic: Pic };

export const ROUND_ASSEMBLE: AssembleStep[] = [
  {
    title: "Solder the headers (skip if they came soldered)",
    body: "Push both strips in from the **back** of the XIAO, the side without the chip, so the short ends come up through the holes on the chip side. Solder all 14 pins there. The long pins point away from the chip. Pressing the long pins into a breadboard holds the strips straight while you solder.",
    pic: {
      illo: "round-headers",
      alt: "The XIAO chip side up, both header strips pushed in from underneath, the 14 solder joints on the chip side highlighted and the long pins pointing down.",
    },
  },
  {
    title: "Plug in the antenna",
    body: "Its small round U.FL plug goes on the matching socket on the chip side, at the end away from the USB-C port. Line it up and press straight down until it clicks.",
    pic: {
      illo: "round-antenna",
      alt: "The antenna plug held above the U.FL socket on the XIAO, with an arrow down onto it, and the flat antenna on its cable to the side.",
    },
  },
  {
    title: "Set both DIP switches to ON",
    body: "Turn the Round Display over. Between the sockets and the microSD slot is a small block of two switches, marked **1 2** and **ON**. They ship OFF: slide both to **ON**. Switch 1 lets the XIAO turn the screen's backlight off after the timeout; switch 2 lets it read a battery's charge if you add one later. Do it now: the XIAO covers them once it's on.",
    pic: {
      illo: "round-dip",
      alt: "The back of the Round Display with the two DIP switches highlighted, arrows sliding both from OFF to ON, next to the sockets the XIAO goes into.",
    },
  },
  {
    title: "Line the XIAO up under the display",
    body: "The XIAO goes on the display's back with the **chip side facing away** from the display, the long pins into the two rows of sockets, and the **USB-C port facing out** to the edge, or the port ends up covered. Leave the antenna on its cable to one side.",
    pic: {
      illo: "round-below",
      alt: "Seen from below: the back of the Round Display with its two rows of sockets, and the XIAO under it, chip side down, USB-C toward the edge, pins lined up with the sockets, the antenna to one side.",
    },
  },
  {
    title: "Press it home and switch it on",
    body: "Push the XIAO evenly into the sockets until the plastic strips touch them. Then slide the small switch on the back of the display to **ON**; in the other position the screen stays dark.",
    pic: {
      illo: "round-switch",
      alt: "Seen from below: the XIAO pressed fully into the display's sockets, the antenna to one side, and the display's power switch highlighted.",
    },
  },
  {
    title: "Plug it in",
    body: "USB-C to your computer for the setup below, and later to a phone charger where the switch lives.",
    pic: {
      illo: "round-done",
      alt: "The finished Round switch, screen on top, with a USB-C cable leaving the port on its right edge.",
    },
  },
];

/** How proven a design is (docs/specs/terms-and-safety.md §2.5). /safety#status explains each. */
export type DesignStatus = "experimental" | "maintainer" | "community";

export const DESIGN_STATUS_LABEL: Record<DesignStatus, string> = {
  experimental: "Experimental",
  maintainer: "Built by the maintainer",
  community: "Community-tested",
};

export const DESIGN_STATUS_TEXT: Record<DesignStatus, string> = {
  experimental: "Designed, never built and installed. Expect mistakes.",
  maintainer: "Built and in use by the maintainer, one installation.",
  community: "Built and reported working by several people.",
};

export const ROUND_STATUS: DesignStatus = "maintainer";

export type Level = {
  id: "try" | "box" | "wall";
  letter: string;
  name: string;
  needs: string;
  who: string;
  status: DesignStatus;
};

export const SIMPLE_LEVELS: Level[] = [
  {
    id: "try",
    letter: "A",
    name: "Try it",
    needs: "The XIAO and a USB-C cable. No wiring.",
    who: "Everyone, first.",
    status: "maintainer",
  },
  {
    id: "box",
    letter: "B",
    name: "Button box on USB-C",
    needs: "The XIAO, switches or buttons, wire. A few resistors if the wires are long.",
    who: "Makers. Low voltage only, no mains anywhere.",
    status: "maintainer",
  },
  {
    id: "wall",
    letter: "C",
    name: "In the wall",
    needs: "Our mains carrier board and printed enclosure, behind your wall switch.",
    who: "Experienced makers, installed by an electrician.",
    status: "experimental",
  },
];

export const TRY_BUY: BuyItem[] = [
  {
    name: "Seeed XIAO ESP32-C6",
    pic: 1,
    why: "The whole switch, for now. With or without headers: this level needs none.",
    href: "https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C6-p-5884.html",
  },
  {
    name: "USB-C cable that carries data",
    pic: 2,
    why: "Charge-only cables are the most common reason the board never shows up on Setup.",
    have: true,
  },
  {
    name: "Chrome or Edge on a computer",
    why: "Setup installs the firmware over USB from the browser. Safari and Firefox can't.",
    have: true,
  },
  {
    name: "A Hue Bridge on the same network",
    why: "With at least one room or zone. The switch talks to it directly.",
    have: true,
  },
];

export const TRY_KIT: Pic = {
  illo: "simple-kit-try",
  alt: "The parts, numbered 1 and 2 like the list below: the XIAO ESP32-C6 and a USB-C cable, with an arrow from the plug to the board's USB-C port.",
};

/** `more`: a second picture under the first. */
export type PicStep = { title: string; body: string; pic: Pic; more?: Pic };

export const TRY_STEPS: PicStep[] = [
  {
    title: "Plug it in",
    body: "USB-C cable from the XIAO to your computer.",
    pic: { illo: "simple-plug", alt: "The XIAO with a USB-C cable plugged into its port." },
  },
  {
    title: "Set it up",
    body: "Follow **Set up a Simple switch** below: install, Wi-Fi, link, pair the Bridge. The orange LED on the board shows what it needs next at every step.",
    pic: { illo: "simple-led", alt: "The XIAO on its cable with the orange status LED lit." },
  },
  {
    title: "Give BOOT a room",
    body: "In the last setup step, Switches opens on **Start with the BOOT button**. Pick a room and click **Save changes**.",
    pic: {
      editor: "boot",
      alt: "The Switches editor for a new Simple switch: the board picture on the left and Start with the BOOT button on the right, with a list of rooms to pick from.",
    },
  },
  {
    title: "Press BOOT",
    body: "The small button next to the USB-C port. The room's lights toggle: board, Wi-Fi, Bridge and console all work. Holding BOOT for about 3 seconds pairs with the Bridge again, unless you give **Hold** another action.",
    pic: { illo: "simple-boot", alt: "A finger arrow pressing BOOT on the XIAO, and a light bulb lit next to it." },
  },
];

export const BOX_BUY: BuyItem[] = [
  {
    name: "Seeed XIAO ESP32-C6",
    pic: 1,
    why: "With or without pre-soldered headers. Headers let you use jumper wires instead of soldering.",
    href: "https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C6-p-5884.html",
  },
  {
    name: "Switches or push buttons, up to six",
    pic: 2,
    why: "Any plain contact: sold as **dry contact** or \"no light\". Wall switches, arcade buttons, tact switches.",
  },
  {
    name: "Hook-up wire",
    pic: 3,
    why: "Any thin insulated wire. Never wire that is, or was, part of your home's mains wiring.",
    have: true,
  },
  {
    name: "A soldering iron, or jumper wires",
    why: "To attach wires to the board's pads. On a XIAO with headers, female jumper wires push on instead.",
    have: true,
  },
  {
    name: "10 kΩ, 1 kΩ, 10 nF per input",
    pic: 4,
    why: "Only for long wires. Two resistors (1/4 W through-hole, any tolerance) and one ceramic capacitor for each input. See **Do I need resistors?**",
    optional: true,
  },
  {
    name: "A box and a USB-C phone charger",
    why: "Any project box that fits the board and the wires.",
    have: true,
  },
];

export const BOX_KIT: Pic = {
  illo: "simple-kit-box",
  alt: "The parts, numbered 1 to 4 like the list below: the XIAO ESP32-C6, two panel push buttons with two solder lugs each, two pieces of hook-up wire, and the two resistors and ceramic capacitor used per input.",
};

export const NEVER: string[] = [
  "Connect a pin to anything that is, or ever was, connected to mains (220 V or 120 V). That includes the wires of an existing wall switch until an electrician has taken them off mains at both ends.",
  "Connect a pin to 5 V or any other supply. The pins take 3.3 V at most.",
  "Run the **3V3** pin out to the switches. It only feeds the pull-up resistors, on the board side.",
  "Use illuminated switches (neon or LED pilot light) or smart switches. They have electronics across the contacts, so the board sees them as always pressed or never pressed.",
];

export const BOX_STEPS: PicStep[] = [
  {
    title: "Set up the board on its own",
    body: "Follow **Set up a Simple switch** below with nothing wired. A board that works bare rules out the board if something goes wrong later.",
    pic: { illo: "simple-led", alt: "The XIAO on its USB-C cable, nothing wired, the orange status LED lit." },
  },
  {
    title: "Test with BOOT",
    body: "Give **BOOT** a room on Switches and press it: the small button next to the USB-C port. The lights react: the board, Wi-Fi, the Bridge and the console all work.",
    pic: { illo: "simple-boot", alt: "A finger arrow pressing BOOT on the XIAO, and a light bulb lit next to it." },
  },
  {
    title: "Attach the first two wires",
    body: "Unplug USB. Solder one wire to **D0** and one to **GND**, or, if your board has headers, use female jumper wires. With the USB-C port at the top and the chip facing you, D0 is the top pad on the left and GND is the second pad on the right.",
    pic: {
      illo: "simple-wires",
      alt: "The XIAO from above, USB-C at the top: an orange wire soldered to D0, the top pad on the left, and a dark wire to GND, the second pad on the right.",
    },
  },
  {
    title: "Connect the first switch",
    body: "One wire to each of its two terminals. Which wire goes on which terminal doesn't matter. A four-leg tact switch has its legs joined in pairs inside: use two diagonally opposite legs.",
    pic: { illo: "simple-switch", alt: "The D0 and GND wires soldered to the two lugs of a panel push button." },
  },
  {
    title: "Set up the input",
    body: "Plug USB back in. On Switches, click **Add a switch**, or the D0 pad on the board picture, and answer its three questions: what you wired (**Wall switch** or **Push button**), the pin (**D0**), and the room. Click **Save changes**, then unplug and replug the board so it picks the change up now.",
    pic: {
      editor: "add",
      alt: "The Switches editor adding a switch: Push button chosen, pin D0 highlighted on the board picture and in the pin list, and the rooms to pick from.",
    },
  },
  {
    title: "Test it",
    body: "Press or flip it: the lights react. If they don't: check the wire is on D0 and not D1, that the input is saved as D0, and that it isn't an illuminated switch.",
    pic: { illo: "simple-test", alt: "The push button pressed and a light bulb lit." },
  },
  {
    title: "Repeat for each input, one at a time",
    body: "D1 to D5, testing each before the next. Every switch's second terminal goes to the same GND: run one wire from switch to switch, soldered at each, and on to GND on the board. A lever connector or a terminal strip works too.",
    pic: {
      illo: "simple-all",
      alt: "Six push buttons in a row, one lug of each wired to its own pad D0 to D5, and one wire running from the other lug of each button to the next and on to GND.",
    },
  },
  {
    title: "Long wires? Add the resistors",
    body: "Per input, at the board: **10 kΩ** from the pin to **3V3**, **1 kΩ** in series between the pin and the wire, and **10 nF** from the wire side of the 1 kΩ to GND. Skip this for wires under about 30 cm. The 10 kΩ can go on the back of the board too. With several inputs, join the 10 kΩ ends first and bring one lead to the 3V3 pad.",
    pic: {
      illo: "simple-rc",
      alt: "At the XIAO: a 10 kΩ resistor over the board from the D0 pad to the 3V3 pad; a 1 kΩ resistor from the D0 pad out to a joint where the switch wire starts; a 10 nF capacitor from that joint to a joint on the GND wire, which runs from the GND pad on to the switch.",
    },
    more: {
      illo: "simple-rc3",
      alt: "Three inputs, D0 to D2: each pad's 1 kΩ fans out to its own joint where its switch wire starts, each joint has a 10 nF to a bared spot on the one GND wire, and the three 10 kΩ bridge the board with their ends joined before a single lead into the 3V3 pad.",
    },
  },
  {
    title: "Close it up",
    body: "The XIAO into a project box, the buttons in its lid, the USB-C cable out through a slot in the side to a phone charger. Press every switch once more.",
    pic: {
      illo: "simple-box",
      alt: "An open project box: the XIAO taped to the floor, its USB-C plug out through a slot in the wall, and the lid hinged back with three buttons, one lug of each wired to D0, D1 or D2 and the other lugs chained to GND.",
    },
  },
];

export const INPUT_EXPLAINED =
  "Each of **D0** to **D5** reads one contact. One side of the switch goes to its pin, the other side to **GND**. Closed means pressed, or on. The board doesn't know what's on a pin until you tell it on Switches: **Wall switch** (stays on or off) or **Push button** (press and release).";

// A wall switch with Flip set to toggle ignores the lever position (docs/specs/toggle-on-flip.md),
// so two of them on one room never disagree.
export const STAIRCASE =
  "**Two switches for one lamp** (a staircase or hallway pair, also called two-way or 3-way): put one board in each switch housing. On Switches, set each input to **Wall switch** with **Flip** on **Each flip toggles the lights**, and pick the same room or zone on both. Either switch then turns the lights on or off, whichever way its lever sits. An old 3-way switch is wired as a plain contact: its common terminal plus one of the other two.";

export const RESISTORS: { lead: string; body: string }[] = [
  {
    lead: "Short wires (on a desk, in a small box, under about 30 cm): no.",
    body: "The firmware turns on the chip's own pull-up resistor and ignores contact bounce shorter than 50 ms. A switch straight between a pin and GND works.",
  },
  {
    lead: "Long wires (metres, or next to mains cables in a wall): yes.",
    body: "Per input: a **10 kΩ** pull-up from the pin to 3V3, a **1 kΩ** resistor in series between the pin and the wire, and a **10 nF** capacitor from the wire side of the 1 kΩ to GND. These are the values on our in-wall board.",
  },
  {
    lead: "What goes wrong without them on long wires.",
    body: "The chip's own pull-up is weak (tens of kΩ). A long wire picks up noise from the mains cables next to it, and the lights switch by themselves: ghost presses. A static spark from touching a switch can reach the pin and damage the chip. The 10 kΩ makes the input stiffer, the 1 kΩ limits the current of a spike, and the 10 nF sends fast noise to GND.",
  },
];

/** `more`: an anchor in the hardware README with the detail. */
export const WALL_REQUIREMENTS: { need: string; why: string; more?: { label: string; anchor: string } }[] = [
  {
    need: "A neutral wire in the box",
    why: "The power supply needs live and neutral. Many switch boxes (in Chile, and in older homes in the US and Europe) only have the two live wires. Without a neutral this board can't be used; there is no safe no-neutral version.",
  },
  {
    need: "Room behind the switch",
    why: "The enclosure is 46 × 56 mm and 26 mm tall. EU round boxes need the deep (60 mm) kind, UK boxes the 47 mm kind, most US single-gang boxes fit. In Chilean rectangular boxes it fits beside a one-module switch, not behind it. Measure yours.",
    more: { label: "Box sizes by country", anchor: "#does-it-fit-my-box" },
  },
  {
    need: "A plastic box",
    why: "A metal box cuts Wi-Fi range a lot.",
  },
  {
    need: "Hue bulbs that can stay powered",
    why: "The wall switch stops switching the lamp. The lamp's power is joined straight through, and the Bridge turns it on and off.",
  },
];

export type InstallStep = { title: string; body: string; who: "you" | "electrician"; more?: string; pic: Pic };

export const WALL_INSTALL: InstallStep[] = [
  {
    title: "Set it up over USB, never on mains",
    body: "Install, Wi-Fi, link, pair the Bridge and set up the inputs, before the XIAO is soldered to the board, or with nothing on the mains terminal. Then unplug USB. From here on, USB is never connected while the board is on mains; updates arrive over Wi-Fi.",
    who: "you",
    more: "#first-setup-usb-never-on-mains",
    pic: { illo: "wall-usb", alt: "The carrier board with the XIAO on a USB-C cable, and a red cross on its empty mains terminal." },
  },
  {
    title: "Breaker off, and check it's dead",
    body: "Switch the circuit off at the breaker, then check at the box with a voltage tester.",
    who: "electrician",
    pic: { illo: "wall-breaker", alt: "A row of breakers with this circuit's breaker switched off, and a two-pole voltage tester in front." },
  },
  {
    title: "Identify the wires in the box",
    body: "Permanent live, neutral, the switched live that runs to the lamp, and the wires that run to each switch. Identify each one by testing it, never by its color: colors differ between countries and with the age of the wiring, and older work may follow no convention at all. No neutral: stop here.",
    who: "electrician",
    more: "#before-you-install-requirements",
    pic: { illo: "wall-identify", alt: "The wall box opened: permanent live and switched live on the pulled-out switch, neutrals joined in one lever connector, earths in another." },
  },
  {
    title: "Make the lamp permanent",
    body: "Join the lamp's switched live to the permanent live with a lever connector (for example a WAGO 221). The lamp now stays powered, and the Hue Bridge turns it on and off.",
    who: "electrician",
    pic: { illo: "wall-lamp", alt: "The lamp's live joined to the permanent live in a lever connector, and nothing left on the switch." },
  },
  {
    title: "Take the switch wires off mains, at both ends",
    body: "Every wire that runs to a switch is disconnected from live, neutral and the lamp, in this box and at the switch. From now on it only joins the switch to the board.",
    who: "electrician",
    pic: { illo: "wall-offmains", alt: "The pulled-out switch with both terminals empty and a No L, no N badge." },
  },
  {
    title: "Wire the switches",
    body: "With the board in its base, lid off, in front of the box: each wire goes through its hole in the base wall into its terminal, and the screws are reached through the slots in the base floor. One terminal of each switch to **D0**–**D5** on J2 and J3. The other terminals joined with a lever connector, and one wire from there to **GND** on J3. J2 and J3 take about 1 mm²: for solid 1.5 mm² wire, join a short 0.5–0.75 mm² flexible pigtail with a lever connector.",
    who: "electrician",
    more: "#wire-it",
    pic: {
      illo: "wall-switches",
      alt: "The board in its open base, held in front of the box: two violet low-voltage wires from the pulled-out switch's terminals, through the base wall, into D0 and GND.",
    },
  },
  {
    title: "Wire mains",
    body: "Permanent live to **L** on J1, from the lever connector that joins the lamp's live. Neutral to **N**, from the neutrals' connector. Both go through the two larger holes in the base wall. Earth stays joined to the box's other earth wires, not to the board.",
    who: "electrician",
    more: "#wire-it",
    pic: {
      illo: "wall-mains",
      alt: "A third wire from the live connector and from the neutral connector, through the two larger holes in the base, into L and N; the earth connector stays as it was, and the violet switch wires are already on D0 and GND.",
    },
  },
  {
    title: "Close it and fit it",
    body: "Tape over the slots in the base floor (Kapton or electrical tape) and click the lid on. Push it to the back of the box: behind the switch, or beside it in a rectangular box.",
    who: "electrician",
    more: "#print-the-enclosure",
    pic: { illo: "wall-fit", alt: "The closed enclosure at the back of the box with every wire in its hole, and the switch still pulled out in front." },
  },
  {
    title: "Check before power",
    body: "Confirm that no switch wire touches mains anywhere, with a continuity tester if needed. If one does, the board and its USB port would be at mains voltage. Then fix the switch back in its box.",
    who: "electrician",
    pic: { illo: "wall-check", alt: "The finished wiring, enclosure at the back, with a Checked badge on the violet wire to the switch." },
  },
  {
    title: "Breaker on, and test",
    body: "Within a minute the board shows as online, a green dot next to it on **Switches**: its LED is behind the switch now. Then press or flip each switch: the lights react.",
    who: "you",
    pic: { illo: "wall-on", alt: "The switch back in the wall and the lamp lit." },
  },
];

export const WALL_BOARD: Pic = {
  illo: "wall-board",
  alt: "The carrier board with the XIAO soldered flat on top, the printed lid above it and the base below it.",
};

export const WALL_BEFORE: Pic = {
  illo: "wall-before",
  alt: "Before: the wall box with the live running through the switch to the lamp.",
};

export const WALL_AFTER: Pic = {
  illo: "wall-after",
  alt: "After: the lamp's live joined to the permanent live, the enclosure at the back of the box on live and neutral only, and two violet low-voltage wires from it to the switch.",
};

export function buildSummary(product: Product): string {
  return product === "round"
    ? "What to buy, soldering the headers if they came loose, and how the parts go together."
    : "Three ways to build one, from no wiring at all to a board inside your wall. What to buy, how to wire it, and whether you need resistors.";
}
