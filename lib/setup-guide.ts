// The steps of Set up over USB, shared by /setup (the stepper) and the How-to setup overview
// (docs/specs/setup-guide.md §2.4). **label** marks a UI label, `code` a literal.

import type { Product } from "@/lib/how-to";

export type GuideStepId = "connect" | "firmware" | "wifi" | "console" | "bridge";

export type GuideStep = {
  id: GuideStepId;
  title: string;
  /** One line for the How-to overview. */
  summary: string;
  why: string;
  trouble: string[];
};

/** What Chrome lists for the XIAO's own USB port (C6, and the S3 on our firmware). */
export const PORT_NAME = "USB JTAG/serial debug unit";

/** Simple firmware from this version restarts into install mode on HUEBOOT, no buttons. */
export const HUEBOOT_SINCE = "0.2.11";

/**
 * How long the Simple keeps asking the Bridge (hue_discover.h kPairTimeoutMs). The Round never
 * gives up: it asks fast for 90 s, then every 3 s (hue_job.h).
 */
export const PAIR_SECONDS = 90;

export const BEFORE_YOU_START = [
  "The switch",
  "A USB-C cable that carries data",
  "Chrome or Edge on a computer",
  "Your 2.4 GHz Wi-Fi name and password",
  "The Hue Bridge on that Wi-Fi",
];

export const CANT_BREAK =
  "The install mode lives in read-only memory inside the chip, and no firmware can erase it. Holding **BOOT** and tapping **RESET** always gets back to it. If an install stops half-way, just install again.";

export function guideSteps(product: Product): GuideStep[] {
  const round = product === "round";
  const things = round ? "pages" : "buttons";
  return [
    {
      id: "connect",
      title: "Connect the board",
      summary: `Plug the XIAO into this computer with a USB-C data cable, click **Connect** and pick **${PORT_NAME}**.`,
      why: "A web page can only talk to a USB device you pick yourself. Chrome asks every time, and the page sees nothing else on your computer.",
      trouble: [
        "**The board isn't in the list:** the cable may be charge-only (many are). Try another cable or another USB port.",
        `**Other entries, after My board isn't in the list:** entries with "Bluetooth" or a device name (headphones, phones, \`…_SPP\`) are Bluetooth devices, not the board. "Paired" only means this site used that port before.`,
        "**Not sure which one?** Unplug the board and click Connect again: the entry that disappeared is the board.",
        "**You picked the wrong entry:** nothing is sent to that device and nothing changes on it. The page finds no XIAO there and asks you to pick again.",
      ],
    },
    {
      id: "firmware",
      title: "Install the firmware",
      summary: round
        ? "Click **Install** and keep the cable in until it finishes. No buttons to press."
        : "Click **Install**. A new board needs two buttons first: hold **BOOT**, tap **RESET**. The page shows you when.",
      why: `The XIAO ships with a demo program from the factory. This replaces it with the ${round ? "Round" : "Simple"} switch firmware, the version this console currently serves. Later updates keep Wi-Fi, the console link and the ${things}.`,
      trouble: [
        "**The chip does not answer:** hold **BOOT**, tap **RESET**, let go of BOOT, and click Install again.",
        "**It stopped part-way:** install again. The chip's install mode can't be overwritten.",
        "**It says this is the other chip:** nothing was written. Pick the other switch.",
      ],
    },
    {
      id: "wifi",
      title: "Save Wi-Fi",
      summary: "Click **Scan**, pick your **2.4 GHz** network, type the password and click **Save Wi-Fi**.",
      why: "The switch talks to your Hue Bridge and to this console over Wi-Fi. The XIAO's radio is 2.4 GHz only, and it must join the same network as the Bridge.",
      trouble: [
        "**Your network isn't listed:** it may be 5 GHz only. Many routers have a 2.4 GHz band you can turn on or give its own name.",
        "**It doesn't connect:** check the password and save it again.",
        ...(round ? ["**The Round can't find any network:** check that the antenna is clicked into its socket."] : []),
      ],
    },
    {
      id: "console",
      title: "Link it to this console",
      summary: "Click **Link to console**. It saves a key on the board so it can fetch what its buttons do.",
      why: `The board downloads its ${things} from this console. The key tells the console which account the board belongs to, and you can revoke it later on API keys.`,
      trouble: [
        "**The console hasn't heard from the board:** it checks in shortly after it joins Wi-Fi. Wait a minute, then check again.",
        "**It talks to another console:** use **Move to this console**.",
      ],
    },
    {
      id: "bridge",
      title: "Pair with the Hue Bridge",
      summary: round
        ? "Press the round button on top of the Hue Bridge once. A short press is enough; the Round waits for it."
        : `Press the round button on top of the Hue Bridge once. A short press is enough; the board keeps asking for ${PAIR_SECONDS} seconds.`,
      why: "The Bridge only lets a new device in after someone presses its button, which proves you are standing next to it. After this the switch talks to the Bridge directly on your network. The console never talks to your Bridge.",
      trouble: [
        round
          ? "**Nothing happens:** click **Pair with Bridge** and press the Bridge's button again."
          : "**Time ran out:** click **Pair with Bridge**, or hold **BOOT** on the board for about 3 seconds, and press the Bridge's button again.",
        "**The board finds no Bridge:** the Bridge and the board must be on the same network, and the Bridge's lights must be on.",
      ],
    },
  ];
}
