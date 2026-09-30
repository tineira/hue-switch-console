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
  | "wall-on";

/** A step's picture: a render, or the real Switches editor in a given state. `alt` describes it. */
export type Pic = ({ illo: IlloId } | { editor: "boot" | "add" }) & { alt: string };

export const HARDWARE_README = "https://github.com/tineira/hue-simple-switch/blob/main/hardware/README.md";

// Anchors inside the Build section. Any of them in the URL opens it.
export const BUILD_ANCHORS = ["build", "buy", "assemble", "try", "wire", "in-wall", "install"] as const;

export type BuyItem = {
  name: string;
  why: string;
  href?: string;
  // "You may already have it": a cable, a charger, wire.
  have?: boolean;
  optional?: boolean;
};

export const ROUND_BUY: BuyItem[] = [
  {
    name: "Seeed Round Display for XIAO",
    why: "The 1.28″ round touch screen and its board. The XIAO plugs into the sockets on its back.",
    href: "https://www.seeedstudio.com/Seeed-Studio-Round-Display-for-XIAO-p-5638.html",
  },
  {
    name: "Seeed XIAO ESP32-S3",
    why: "The plain S3. It must be an S3: the C3 and C6 don't run the Round firmware. The S3 **Sense** (with camera) fits the display but hasn't been tested with this firmware.",
    href: "https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html",
  },
  {
    name: "Pin headers",
    why: "Two strips of 7 pins. Seeed sells the XIAO with them **loose in the bag** or **already soldered**. Loose ones have to be soldered on (step 1); pick the pre-soldered XIAO to skip that.",
  },
  {
    name: "2.4 GHz antenna",
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
  alt: "The parts: the Round Display, the XIAO ESP32-S3, two pin header strips and the flat antenna on its thin cable.",
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
    title: "Line the XIAO up under the display",
    body: "Turn the Round Display over. The XIAO goes on its back with the **chip side facing away** from the display, the long pins into the two rows of sockets, and the **USB-C port facing out** to the edge, or the port ends up covered. Fold the flat antenna over the chip side.",
    pic: {
      illo: "round-below",
      alt: "Seen from below: the back of the Round Display with its two rows of sockets and power switch, and the XIAO under it, chip side down, USB-C toward the edge, pins lined up with the sockets.",
    },
  },
  {
    title: "Press it home and switch it on",
    body: "Push the XIAO evenly into the sockets until the plastic strips touch them. Then slide the small switch on the back of the display to **ON**; in the other position the screen stays dark.",
    pic: {
      illo: "round-switch",
      alt: "Seen from below: the XIAO pressed fully into the display's sockets, the antenna folded over it, and the display's power switch highlighted.",
    },
  },
  {
    title: "Plug it in",
    body: "USB-C to your computer for the setup below, and later to a phone charger where the switch lives.",
    pic: {
      illo: "round-done",
      alt: "The finished Round switch, screen on top, with a USB-C cable in the port at its edge.",
    },
  },
];

export type Level = {
  id: "try" | "box" | "wall";
  letter: string;
  name: string;
  needs: string;
  who: string;
};

export const SIMPLE_LEVELS: Level[] = [
  {
    id: "try",
    letter: "A",
    name: "Try it",
    needs: "The XIAO and a USB-C cable. No wiring.",
    who: "Everyone, first.",
  },
  {
    id: "box",
    letter: "B",
    name: "Button box on USB-C",
    needs: "The XIAO, switches or buttons, wire. A few resistors if the wires are long.",
    who: "Makers. Low voltage only, no mains anywhere.",
  },
  {
    id: "wall",
    letter: "C",
    name: "In the wall",
    needs: "Our mains carrier board and printed enclosure, behind your wall switch.",
    who: "Experienced makers, installed by an electrician.",
  },
];

export const TRY_BUY: BuyItem[] = [
  {
    name: "Seeed XIAO ESP32-C6",
    why: "The whole switch, for now. With or without headers: this level needs none.",
    href: "https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C6-p-5884.html",
  },
  {
    name: "USB-C cable that carries data",
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
  alt: "The XIAO ESP32-C6 and a USB-C cable, with an arrow from the plug to the board's USB-C port.",
};

export type PicStep = { title: string; body: string; pic: Pic };

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
    why: "With or without pre-soldered headers. Headers let you use jumper wires instead of soldering.",
    href: "https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C6-p-5884.html",
  },
  {
    name: "Switches or push buttons, up to six",
    why: "Any plain contact: sold as **dry contact** or \"no light\". Wall switches, arcade buttons, tact switches.",
  },
  {
    name: "Hook-up wire",
    why: "Any thin insulated wire. Never wire that is, or was, part of your home's mains wiring.",
    have: true,
  },
  {
    name: "A soldering iron, or jumper wires",
    why: "To attach wires to the board's pads. On a XIAO with headers, female jumper wires push on instead.",
    have: true,
  },
  {
    name: "Per input, for long wires: 10 kΩ, 1 kΩ, 10 nF",
    why: "Two resistors (1/4 W through-hole, any tolerance) and one ceramic capacitor. See **Do I need resistors?**",
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
  alt: "The parts: the XIAO ESP32-C6, two push buttons, two resistors, a ceramic capacitor and two pieces of hook-up wire.",
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
    body: "One wire to each of its two terminals. Which wire goes on which terminal doesn't matter.",
    pic: { illo: "simple-switch", alt: "The D0 and GND wires going to the two legs of a push button." },
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
    body: "D1 to D5, testing each before the next. Every switch's second wire goes to the same GND: join them with a lever connector or a terminal strip and bring one wire to the board.",
    pic: {
      illo: "simple-all",
      alt: "Six push buttons in a row, each wired to its own pad D0 to D5, and one common wire joining their other legs to GND.",
    },
  },
  {
    title: "Long wires? Add the resistors",
    body: "Per input, at the board: **10 kΩ** from the pin to **3V3**, **1 kΩ** in series between the pin and the wire, and **10 nF** from the wire side of the 1 kΩ to GND. Skip this for wires under about 30 cm.",
    pic: {
      illo: "simple-rc",
      alt: "At D0: a 10 kΩ resistor bridging from D0 to the 3V3 pad, a 1 kΩ resistor in line with the wire, and a 10 nF capacitor from the far side of the 1 kΩ to the GND wire.",
    },
  },
  {
    title: "Close it up",
    body: "The XIAO into a project box, the buttons in its lid, the USB-C cable out through a hole to a phone charger. Press every switch once more.",
    pic: { illo: "simple-box", alt: "An open project box with the XIAO inside, the USB-C cable out through the side, and the lid with three buttons above it." },
  },
];

export const INPUT_EXPLAINED =
  "Each of **D0** to **D5** reads one contact. One side of the switch goes to its pin, the other side to **GND**. Closed means pressed, or on. The board doesn't know what's on a pin until you tell it on Switches: **Wall switch** (stays on or off) or **Push button** (press and release).";

// A maintained channel maps closed to on and open to off (docs/definitions.md), so two
// switches on one room disagree. Supporting the pair needs a new channel kind.
export const STAIRCASE =
  "**Two switches for one lamp** (a staircase or hallway pair, also called two-way or 3-way) aren't supported yet. A **Wall switch** input means on when closed and off when open, so two of them on one room disagree. Wire each as its own input for different rooms, or use push buttons, which toggle.";

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

export const WALL_REQUIREMENTS: { need: string; why: string }[] = [
  {
    need: "A neutral wire in the box",
    why: "The power supply needs live and neutral. Many switch boxes (in Chile, and in older homes in the US and Europe) only have the two live wires. Without a neutral this board can't be used; there is no safe no-neutral version.",
  },
  {
    need: "Room behind the switch",
    why: "The enclosure is 46 × 56 mm and 26 mm tall. EU round boxes need the deep (60 mm) kind, UK boxes the 47 mm kind, most US single-gang boxes fit. In Chilean rectangular boxes it fits beside a one-module switch, not behind it. Measure yours.",
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
    pic: { illo: "wall-breaker", alt: "A row of breakers with this circuit's breaker switched off." },
  },
  {
    title: "Identify the wires in the box",
    body: "Permanent live, neutral, the switched live that runs to the lamp, and the wires that run to each switch. No neutral: stop here.",
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
    pic: { illo: "wall-offmains", alt: "The switch with its terminals free and a No L, no N badge, and the carrier board at the back of the box." },
  },
  {
    title: "Wire the switches",
    body: "One terminal of each switch to **D0**–**D5** on J2 and J3. The other terminals joined with a lever connector, and one wire from there to **GND** on J3. Solid 1.5 mm² wire goes through a short 0.5–0.75 mm² flexible pigtail.",
    who: "electrician",
    more: "#wire-it",
    pic: { illo: "wall-switches", alt: "Two orange low-voltage wires from the switch's terminals to D0 and GND on the carrier board." },
  },
  {
    title: "Wire mains",
    body: "Permanent live to **L** on J1, neutral to **N**. Earth stays joined to the box's other earth wires, not to the board.",
    who: "electrician",
    more: "#wire-it",
    pic: { illo: "wall-mains", alt: "Live from the joined lever connector to L on the board, and neutral from the neutral connector to N." },
  },
  {
    title: "Fit the enclosure",
    body: "Behind the switch, or beside it in a rectangular box. Switch wires through the holes on the low-voltage side, live and neutral through the two larger ones.",
    who: "electrician",
    pic: { illo: "wall-fit", alt: "The board inside its printed enclosure at the back of the box, the switch in front of it." },
  },
  {
    title: "Check before power",
    body: "Confirm that no switch wire touches mains anywhere, with a continuity tester if needed. If one does, the board and its USB port would be at mains voltage.",
    who: "electrician",
    pic: { illo: "wall-check", alt: "The finished wiring with a Checked badge on the switch wires." },
  },
  {
    title: "Breaker on, and test",
    body: "The orange LED should give one short blink every few seconds (see **Reading the LED**). Then press or flip each switch: the lights react.",
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
  illo: "wall-mains",
  alt: "After: the lamp's live joined to the permanent live, the board at the back of the box on live and neutral, and the switch wired to the board with low-voltage wires.",
};

export function buildSummary(product: Product): string {
  return product === "round"
    ? "What to buy, soldering the headers if they came loose, and how the parts go together."
    : "Three ways to build one, from no wiring at all to a board inside your wall. What to buy, how to wire it, and whether you need resistors.";
}
