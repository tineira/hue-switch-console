// Copy for the Build part of /how-to: what to buy and how to put each switch together
// (docs/specs/build-guides.md). **label** marks a UI label or key term, as in lib/how-to.ts.
//
// The resistor and capacitor values must match the mains carrier board's input circuit
// (R1–R6, R11–R16, C11–C16 in hue-simple-switch/hardware/). Change both together.

import type { Product } from "@/lib/how-to";

export const HARDWARE_README = "https://github.com/tineira/hue-simple-switch/blob/main/hardware/README.md";

// Anchors inside the Build section. Any of them in the URL opens it.
export const BUILD_ANCHORS = ["build", "buy", "assemble", "wire", "in-wall", "install"] as const;

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
];

export type AssembleStep = {
  title: string;
  body: string;
  stage: "antenna" | "exploded" | "assembled";
};

export const ROUND_ASSEMBLE: AssembleStep[] = [
  {
    title: "Plug in the antenna",
    body: "Its small round U.FL plug goes on the matching socket on the XIAO. Line it up and press straight down until it clicks. Tuck the flat antenna under the board.",
    stage: "antenna",
  },
  {
    title: "Line the XIAO up with the display",
    body: "The pins along the XIAO's two long edges go into the two rows of sockets on the back of the Round Display. Turn it so the XIAO's **USB-C port faces out**, towards the edge of the round board, or the port ends up covered.",
    stage: "exploded",
  },
  {
    title: "Press it home and switch it on",
    body: "Push the XIAO evenly into the sockets. No soldering. Then slide the small switch on the display board to **ON**; in the other position the screen stays dark.",
    stage: "assembled",
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
    needs: "The XIAO and a USB-C cable. Nothing else.",
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

export const TRY_STEPS: string[] = [
  "Follow **Set up a Simple switch** below with nothing wired to the board.",
  "In the last step, give **BOOT** (the button on the board) a room and click **Save changes**.",
  "Press BOOT: the room's lights toggle. That's the whole switch working, board to Bridge.",
  "Holding BOOT for about 3 seconds pairs with the Bridge again, unless you give **Hold** another action.",
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
    why: "Any thin wire for short runs, or the switch wires already in your wall for long ones.",
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

export const NEVER: string[] = [
  "Connect a pin to anything that is, or ever was, connected to mains (220 V or 120 V). That includes the wires of an existing wall switch until an electrician has taken them off mains at both ends.",
  "Connect a pin to 5 V or any other supply. The pins take 3.3 V at most.",
  "Run the **3V3** pin out to the switches. It only feeds the pull-up resistors, on the board side.",
  "Use illuminated switches (neon or LED pilot light) or smart switches. They have electronics across the contacts, so the board sees them as always pressed or never pressed.",
];

export type WireStep = {
  title: string;
  body: string;
  drawing: "bare" | "boot" | "pads" | "switch" | "console" | "test" | "all" | "rc" | "done";
};

export const BOX_STEPS: WireStep[] = [
  {
    title: "Set up the board on its own",
    body: "Follow **Set up a Simple switch** below with nothing wired. A board that works bare rules out the board if something goes wrong later.",
    drawing: "bare",
  },
  {
    title: "Test with BOOT",
    body: "Give **BOOT** a room on Switches and press it. The lights react: the board, Wi-Fi, the Bridge and the console all work.",
    drawing: "boot",
  },
  {
    title: "Attach the first two wires",
    body: "Unplug USB. Solder one wire to **D0** and one to **GND**, or, if your board has headers, use female jumper wires. With the USB-C port at the top and the chip facing you, D0 is the top pad on the left and GND is the second pad on the right.",
    drawing: "pads",
  },
  {
    title: "Connect the first switch",
    body: "One wire to each of its two terminals. Which wire goes on which terminal doesn't matter.",
    drawing: "switch",
  },
  {
    title: "Set up the input",
    body: "Plug USB back in. On Switches, click **Add a switch**: what it is (**Wall switch** or **Push button**), pin **D0**, and a room. Click **Save changes**, then unplug and replug the board so it picks the change up now.",
    drawing: "console",
  },
  {
    title: "Test it",
    body: "Press or flip it: the lights react. If they don't: check the wire is on D0 and not D1, that the input is saved as D0, and that it isn't an illuminated switch.",
    drawing: "test",
  },
  {
    title: "Repeat for each input, one at a time",
    body: "D1 to D5, testing each before the next. Every switch's second wire goes to the same GND: join them with a lever connector or a terminal strip and bring one wire to the board.",
    drawing: "all",
  },
  {
    title: "Long wires? Add the resistors",
    body: "Per input, at the board: **10 kΩ** from the pin to **3V3**, **1 kΩ** in series between the pin and the wire, and **10 nF** from the wire side of the 1 kΩ to GND. Skip this for wires under about 30 cm.",
    drawing: "rc",
  },
  {
    title: "Close it up",
    body: "Into the box, plug in the USB-C charger, and press every switch once more.",
    drawing: "done",
  },
];

export const INPUT_EXPLAINED =
  "Each of **D0** to **D5** reads one contact. One side of the switch goes to its pin, the other side to **GND**. Closed means pressed, or on. The board doesn't know what's on a pin until you tell it on Switches: **Wall switch** (stays on or off) or **Push button** (press and release).";

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

export type InstallStep = { title: string; body: string; who: "you" | "electrician"; more?: string };

export const WALL_INSTALL: InstallStep[] = [
  {
    title: "Set it up over USB, never on mains",
    body: "Install, Wi-Fi, link, pair the Bridge and set up the inputs, before the XIAO is soldered to the board, or with nothing on the mains terminal. Then unplug USB. From here on, USB is never connected while the board is on mains; updates arrive over Wi-Fi.",
    who: "you",
    more: "#first-setup-usb-never-on-mains",
  },
  {
    title: "Breaker off, and check it's dead",
    body: "Switch the circuit off at the breaker, then check at the box with a voltage tester.",
    who: "electrician",
  },
  {
    title: "Identify the wires in the box",
    body: "Permanent live, neutral, the switched live that runs to the lamp, and the wires that run to each switch. No neutral: stop here.",
    who: "electrician",
    more: "#before-you-install-requirements",
  },
  {
    title: "Make the lamp permanent",
    body: "Join the lamp's switched live to the permanent live with a lever connector (for example a WAGO 221). The lamp now stays powered, and the Hue Bridge turns it on and off.",
    who: "electrician",
  },
  {
    title: "Take the switch wires off mains, at both ends",
    body: "Every wire that runs to a switch is disconnected from live, neutral and the lamp, in this box and at the switch. From now on it only joins the switch to the board.",
    who: "electrician",
  },
  {
    title: "Wire the switches",
    body: "One terminal of each switch to **D0**–**D5** on J2 and J3. The other terminals joined with a lever connector, and one wire from there to **GND** on J3. Solid 1.5 mm² wire goes through a short 0.5–0.75 mm² flexible pigtail.",
    who: "electrician",
    more: "#wire-it",
  },
  {
    title: "Wire mains",
    body: "Permanent live to **L** on J1, neutral to **N**. Earth stays joined to the box's other earth wires, not to the board.",
    who: "electrician",
    more: "#wire-it",
  },
  {
    title: "Fit the enclosure",
    body: "Behind the switch, or beside it in a rectangular box. Switch wires through the holes on the low-voltage side, live and neutral through the two larger ones.",
    who: "electrician",
  },
  {
    title: "Check before power",
    body: "Confirm that no switch wire touches mains anywhere, with a continuity tester if needed. If one does, the board and its USB port would be at mains voltage.",
    who: "electrician",
  },
  {
    title: "Breaker on, and test",
    body: "The orange LED should give one short blink every few seconds (see **Reading the LED**). Then press or flip each switch: the lights react.",
    who: "you",
  },
];

export function buildSummary(product: Product): string {
  return product === "round"
    ? "Three parts that plug together, no soldering. What to buy and how they go together."
    : "Three ways to build one, from no wiring at all to a board inside your wall. What to buy, how to wire it, and whether you need resistors.";
}
