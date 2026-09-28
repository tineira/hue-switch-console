// Copy for /how-to, per product. **label** marks a UI label; the page renders it in the
// foreground colour.

export type Product = "round" | "simple";

export const PRODUCTS: Product[] = ["round", "simple"];

export const HOWTO_PRODUCT_KEY = "hsw-howto-product";

export function isProduct(value: unknown): value is Product {
  return value === "round" || value === "simple";
}

// Blink timings live in globals.css (.led-*) and mirror led.h in hue-simple-switch.
export type Pattern = "fast" | "burst-2" | "burst-3" | "burst-4" | "heart" | "solid";

// Round screens drawn on this page. Ring colours and pulses live in globals.css
// (.round-face-*) and mirror ui.h in hue-round-switch.
export type FaceKind =
  | "wifi"
  | "nowifi"
  | "loading"
  | "pairing"
  | "nobridge"
  | "empty"
  | "ready"
  | "flash"
  | "token"
  | "tokenfull";

export type Visual = { led: Pattern } | { face: FaceKind };

export type ProductInfo = { name: string; blurb: string; visual: Visual };

export const PRODUCT_INFO: Record<Product, ProductInfo> = {
  round: {
    name: "Round switch",
    blurb: "Round touch screen · XIAO ESP32-S3",
    visual: { face: "ready" },
  },
  simple: {
    name: "Simple switch",
    blurb: "Wall buttons, one orange LED · XIAO ESP32-C6",
    visual: { led: "heart" },
  },
};

export const NEEDS = [
  "The switch",
  "A USB-C data cable",
  "Chrome or Edge",
  "The Hue Bridge on the same network",
];

export type SetupStep = {
  title: string;
  where?: string;
  href?: string;
  body: string;
  note?: string;
  // What the switch shows once this step is done.
  shows?: { caption: string; visual: Visual };
};

export type Task = { title: string; steps: string[] };

export type StatusGroup = "setup" | "ok" | "bad";

export type Status = {
  key: string;
  group: StatusGroup;
  visual: Visual;
  state: string;
  see: string;
  means: string;
  fix?: string;
  href?: string;
  cta?: string;
};

export function setupSteps(product: Product): SetupStep[] {
  const round = product === "round";
  return [
    {
      title: "Plug it in",
      where: "Open Setup",
      href: "/setup",
      body: "Connect the board to this computer with a USB-C cable that carries data. Charge-only cables never show up. On Setup, click **Detect device** and pick the board's port in the window Chrome opens.",
    },
    {
      title: "Install the firmware",
      where: "Setup",
      href: "/setup",
      body: round
        ? "Click **Install** and keep the cable in until it finishes."
        : "Hold **BOOT** on the board while you click **Install**, then keep the cable in until it finishes. A new Simple switch only accepts firmware this way.",
      shows: round
        ? { caption: "No Wi-Fi. Expected: none saved yet.", visual: { face: "nowifi" } }
        : { caption: "Fast blink: no Wi-Fi yet", visual: { led: "fast" } },
    },
    {
      title: "Save Wi-Fi",
      where: "Setup",
      href: "/setup",
      body: "Click **Set up Wi-Fi** and pick a **2.4 GHz** network. The board can't join 5 GHz.",
      note: round ? "The Round needs its U.FL antenna plugged in to reach the router." : undefined,
      shows: round
        ? { caption: "Loading…, then Press Bridge button", visual: { face: "loading" } }
        : { caption: "Two blinks: needs the console", visual: { led: "burst-2" } },
    },
    {
      title: "Link it to this console",
      where: "Setup",
      href: "/setup",
      body: "Click **Link to console**. This saves a device key on the board so it can fetch what its buttons do.",
      note: "Wi-Fi or Console can turn amber for a moment while the board joins. Setup checks again every 10 seconds, up to three times, then offers **Check again**.",
      shows: round
        ? { caption: "Press Bridge button: it waits until step 5", visual: { face: "pairing" } }
        : { caption: "Three blinks: needs pairing", visual: { led: "burst-3" } },
    },
    {
      title: "Approve it on the Hue Bridge",
      body: "Press the round button on top of the Hue Bridge.",
      note: "Missed it? Click **Pair with Bridge** on Setup, or hold **BOOT** on the board for about 3 seconds.",
      shows: round
        ? { caption: "Blank disc: needs a page", visual: { face: "empty" } }
        : { caption: "Four blinks: needs a recipe", visual: { led: "burst-4" } },
    },
    {
      title: round ? "Give it a page" : "Give its buttons a job",
      where: "Open Switches",
      href: "/switches",
      body: round
        ? "Pick the switch, click **Add page** and choose a room or zone. Tap toggles its lights and double tap turns them off. Click **Save changes**."
        : "Pick the switch and start with **BOOT**, the button on the board: choose a room or zone, click **Save changes**, and press BOOT to test. Then click **Add a switch** for each switch or button you wired: what it is (**Wall switch** or **Push button**), which pin, which room.",
      shows: round
        ? { caption: "Ready", visual: { face: "ready" } }
        : { caption: "Ready", visual: { led: "heart" } },
    },
  ];
}

export function tasks(product: Product): Task[] {
  const round = product === "round";
  return [
    round
      ? {
          title: "Change what a page does",
          steps: [
            "Open **Switches** and pick the switch from the tabs.",
            "On a page, click **Change** next to Tap or Double tap. Both start on the whole room. Pick another action, one light, or scenes.",
            "Several scenes make a list the press steps through: up to 8, from the page's room or zone.",
            "Click **Save changes**. The dimmer ring always follows the page's lights.",
          ],
        }
      : {
          title: "Change what a button does",
          steps: [
            "Open **Switches**, pick the switch from the tabs, then pick the switch you want from the list or on the board picture.",
            "**Wall switch**: the lever turns the lights on and off. A quick off-on flick steps through the scenes under **Double-click**.",
            "**Push button**: a click toggles the lights. **Double-click** can step through scenes. **Hold** can dim (it ramps while you hold and stops when you let go) or turn off the whole room.",
            "Every gesture targets the whole room until you click **Change** to pick one light or scenes. Give it a name so you can tell switches apart. Click **Save changes**.",
          ],
        },
    round
      ? {
          title: "Name a page, pick its theme, set the screen",
          steps: [
            "On Switches, each page has a name and a theme. The theme sets the colours on the Round's screen.",
            "Under **Device**, set which way you swipe between pages and how long the screen stays on.",
          ],
        }
      : {
          title: "Use the BOOT button",
          steps: [
            "BOOT, the button on the board, is at the top of the switch list. It is the easiest way to test the switch before you wire anything.",
            "It works like any push button: click and double-click do what you set.",
            "Its **Hold** pairs the board with the Bridge again, unless you give Hold another action. **Clear BOOT settings** brings re-pairing back.",
          ],
        },
    {
      title: "Make a change apply right away",
      steps: [
        `Each gesture says in words what it will do. Click **Save changes**, and the switch picks the change up the next time it checks in, within an hour.`,
        "To apply it now, unplug the board and plug it back in.",
        "Changes on several switches? **Save all** saves them together.",
      ],
    },
    {
      title: "Update the firmware",
      steps: [
        "On Switches, a switch with newer firmware shows **Update to**. Click it.",
        "Plug the board in, click **Detect device** on Setup, then **Update**.",
        `Wi-Fi, the console link and its ${round ? "pages" : "buttons"} are kept.`,
      ],
    },
    {
      title: "Pair with the Bridge again",
      steps: [
        "Hold **BOOT** on the board for about 3 seconds, or plug it in and click **Pair with Bridge** on Setup.",
        "Press the button on top of the Hue Bridge.",
      ],
    },
    {
      title: "Rename a switch",
      steps: ["On Switches, click the pencil next to its name. The name is only used in this console."],
    },
    {
      title: "Let Arduino IDE use the USB port",
      steps: [
        "The console holds the port while a board is detected. Click **Disconnect** on Setup to release it for Arduino IDE or a serial monitor.",
      ],
    },
    {
      title: "Retire a lost or given-away board",
      steps: [
        "If you still have the board, plug it in on **Setup** and click **Erase settings** under Reset board. It forgets your Wi-Fi name and password, the console link, the Hue link and its settings.",
        "Open **API keys** from the menu under your email and revoke the board's key.",
        "If the board is lost, change your Wi-Fi password: the board still knows the old one.",
        "Keys under **Not in use** belong to no board and can go too.",
      ],
    },
  ];
}

const ROUND_STATUS: Status[] = [
  {
    key: "wifi",
    group: "setup",
    visual: { face: "wifi" },
    state: "Joining Wi-Fi",
    see: "Wi-Fi… and the firmware version",
    means: "The board is joining the saved network. This usually takes a few seconds. Nothing to do.",
  },
  {
    key: "loading",
    group: "setup",
    visual: { face: "loading" },
    state: "Finding the Bridge",
    see: "Loading…, Connecting, ring pulses",
    means: "Wi-Fi is up. The board is looking for the Hue Bridge on the network. Nothing to do.",
  },
  {
    key: "pairing",
    group: "setup",
    visual: { face: "pairing" },
    state: "Needs pairing",
    see: "Press Bridge button, ring flashes yellow",
    means:
      "The board found the Bridge and waits for you to approve it. It also shows this when the Bridge rejects the saved key twice, and then pairs again by itself.",
    fix: "Press the round button on top of the Hue Bridge. To pair again later, hold **BOOT** for about 3 seconds.",
  },
  {
    key: "empty",
    group: "setup",
    visual: { face: "empty" },
    state: "Needs a page",
    see: "A blank disc that says Page",
    means: "The Bridge is paired, and this Round has no pages yet.",
    fix: "Add at least one page on Switches.",
    href: "/switches",
    cta: "Open Switches",
  },
  {
    key: "ready",
    group: "ok",
    visual: { face: "ready" },
    state: "Ready",
    see: "Page name, scene, brightness ring, page dots",
    means:
      "Tap or double tap runs the page, swipe changes page, the ring dims. The disc shows … while a press is sent. After the screen timeout it goes dark, and the first touch only wakes it.",
  },
  {
    key: "nowifi",
    group: "bad",
    visual: { face: "nowifi" },
    state: "No Wi-Fi",
    see: "No Wi-Fi, Plug the antenna",
    means:
      "The board couldn't join Wi-Fi, or no network is saved. The XIAO S3 needs its U.FL antenna to reach the router.",
    fix: "Plug in the antenna. If it's already in, save a 2.4 GHz network on Setup.",
    href: "/setup",
    cta: "Open Setup",
  },
  {
    key: "nobridge",
    group: "bad",
    visual: { face: "nobridge" },
    state: "Bridge not reachable",
    see: "No Bridge, same LAN as Bridge",
    means:
      "The board can't find the Bridge on this network. It keeps retrying, and after a short Bridge or Wi-Fi outage it reconnects by itself.",
    fix: "Check that the Bridge is on and on the same network as the board.",
  },
  {
    key: "flash",
    group: "bad",
    visual: { face: "flash" },
    state: "Command failed",
    see: "Ring flashes red for about 0.7 s",
    means:
      "A press didn't reach the Bridge. The screen stays on the page and shows what the Bridge reports a moment later, so you can tap again right away.",
    fix: "If it keeps happening, check that the Bridge is on and on the same network.",
  },
  {
    key: "token",
    group: "bad",
    visual: { face: "token" },
    state: "Token rejected",
    see: "Red dot at the bottom, stays until fixed",
    means:
      "The console rejected the device token. The switch keeps working with the recipes it already has, but can't get changes.",
    fix: "Save a new token on Setup.",
    href: "/setup",
    cta: "Open Setup",
  },
  {
    key: "tokenfull",
    group: "bad",
    visual: { face: "tokenfull" },
    state: "Token rejected, nothing saved",
    see: "Full-screen message, stays until fixed",
    means:
      "The console rejected the token and this Round has no recipes yet, so presses have nothing to run.",
    fix: "Save a new token on Setup.",
    href: "/setup",
    cta: "Open Setup",
  },
];

const SIMPLE_STATUS: Status[] = [
  {
    key: "fast",
    group: "setup",
    visual: { led: "fast" },
    state: "No Wi-Fi",
    see: "Fast blink, no pause",
    means: "The board is not on Wi-Fi.",
    fix: "Connect the board over USB and save a 2.4 GHz network on Setup.",
    href: "/setup",
    cta: "Open Setup",
  },
  {
    key: "burst-2",
    group: "setup",
    visual: { led: "burst-2" },
    state: "Needs the console",
    see: "Two blinks, then a pause",
    means: "Wi-Fi is up. The console address or the device token is missing.",
    fix: "Save a token on Setup.",
    href: "/setup",
    cta: "Open Setup",
  },
  {
    key: "burst-3",
    group: "setup",
    visual: { led: "burst-3" },
    state: "Needs pairing",
    see: "Three blinks, then a pause",
    means:
      "The board can't use the Hue Bridge yet. It isn't paired, pairing is running, or the Bridge is missing or rejected it.",
    fix: "Hold **BOOT** for about 3 seconds, or use **Pair with Bridge** on Setup, then press the button on the Hue Bridge.",
  },
  {
    key: "burst-4",
    group: "setup",
    visual: { led: "burst-4" },
    state: "Needs a recipe",
    see: "Four blinks, then a pause",
    means: "The Bridge is paired, and no recipes are saved.",
    fix: "Save at least one recipe on Switches.",
    href: "/switches",
    cta: "Open Switches",
  },
  {
    key: "heart",
    group: "ok",
    visual: { led: "heart" },
    state: "Ready",
    see: "One short blink about every 3 seconds",
    means:
      "Wi-Fi, the console, the Bridge and at least one recipe are set. One recipe on any channel is enough. A press that doesn't reach the Bridge doesn't change the pattern.",
  },
  {
    key: "solid",
    group: "bad",
    visual: { led: "solid" },
    state: "Error",
    see: "Solid on",
    means:
      "The console rejected the device token, or the console task on the board didn't start. This wins over every blink, and losing Wi-Fi doesn't turn it off. It clears once the console accepts the board.",
    fix: "Save a new token on Setup.",
    href: "/setup",
    cta: "Open Setup",
  },
];

export function statuses(product: Product): Status[] {
  return product === "round" ? ROUND_STATUS : SIMPLE_STATUS;
}
