// Where a reader is on /how-to: switch, then topic, then (Simple build only) build type. All of
// it lives in the query string, so every view has its own URL (docs/specs/how-to-navigation.md).

import { PRODUCTS, PRODUCT_INFO, isProduct, type Product } from "@/lib/how-to";
import { SIMPLE_LEVELS, type Level } from "@/lib/how-to-build";

export type Topic = "build" | "setup" | "tasks" | "status";
export type LevelId = Level["id"];

export const TOPICS: Topic[] = ["build", "setup", "tasks", "status"];

// B by default: its first steps are A, and it's what most builders came for.
export const DEFAULT_LEVEL: LevelId = "box";

export type HowTo = { product: Product | null; topic: Topic | null; level: LevelId };

export function isTopic(value: unknown): value is Topic {
  return TOPICS.includes(value as Topic);
}

function isLevel(value: unknown): value is LevelId {
  return value === "try" || value === "box" || value === "wall";
}

type Param = string | string[] | null | undefined;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v);

/** From the query string. A topic needs a switch; a level only means something on Simple's Build. */
export function readHowTo(get: (key: string) => Param): HowTo {
  const product = one(get("product"));
  const topic = one(get("topic"));
  const level = one(get("level"));
  const p = isProduct(product) ? product : null;
  const t = p && isTopic(topic) ? topic : null;
  return { product: p, topic: t, level: p === "simple" && t === "build" && isLevel(level) ? level : DEFAULT_LEVEL };
}

export function howToHref({ product, topic, level }: Partial<HowTo>, hash = ""): string {
  const q = new URLSearchParams();
  if (product) {
    q.set("product", product);
    if (topic) q.set("topic", topic);
    if (product === "simple" && topic === "build") q.set("level", level ?? DEFAULT_LEVEL);
  }
  const query = q.toString();
  return `/how-to${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Every view with content, for the sitemap: each switch's topics, the Simple's Build once per build type. */
export function howToPages(): string[] {
  return PRODUCTS.flatMap((product) =>
    TOPICS.flatMap((topic) =>
      product === "simple" && topic === "build"
        ? SIMPLE_LEVELS.map((l) => howToHref({ product, topic, level: l.id }))
        : [howToHref({ product, topic })],
    ),
  );
}

export function topicLabel(product: Product, topic: Topic): string {
  switch (topic) {
    case "build":
      return "Build it";
    case "setup":
      return "Set up";
    case "tasks":
      return "Everyday tasks";
    case "status":
      return product === "round" ? "Reading the screen" : "Reading the LED";
  }
}

export function topicHint(product: Product, topic: Topic): string {
  switch (topic) {
    case "build":
      return product === "round" ? "Parts and assembly" : "Three ways to build one";
    case "setup":
      return "Firmware, Wi-Fi, Bridge";
    case "tasks":
      return "Change what it does";
    case "status":
      return product === "round" ? "What each screen means" : "What each blink means";
  }
}

const DESCRIPTION: Record<Product, Record<Topic, string>> = {
  round: {
    build: "What to buy for a Round switch for Philips Hue and how its parts go together.",
    setup: "Set up a Round switch for Philips Hue: install the firmware, join Wi-Fi and pair it with the Hue Bridge.",
    tasks: "Change what a Round switch for Philips Hue does: what each page does, its name and theme, firmware updates and pairing again.",
    status: "What each screen on a Round switch for Philips Hue means, and what to do when something is wrong.",
  },
  simple: {
    build: "Three ways to build a Simple switch for Philips Hue: try it on USB, a button box, or a board inside your wall.",
    setup: "Set up a Simple switch for Philips Hue: install the firmware, join Wi-Fi and pair it with the Hue Bridge.",
    tasks: "Change what a Simple switch for Philips Hue does: what each button does, BOOT, firmware updates and pairing again.",
    status: "What each blink of the LED on a Simple switch for Philips Hue means, and what to do when something is wrong.",
  },
};

export function howToTitle({ product, topic }: HowTo): string {
  if (!product) return "How-to";
  const name = PRODUCT_INFO[product].name;
  return topic ? `${name}: ${topicLabel(product, topic)}` : `How-to: ${name}`;
}

export function howToDescription({ product, topic }: HowTo): string {
  if (product && topic) return DESCRIPTION[product][topic];
  if (product === "round") return "Build a Round switch for Philips Hue, set it up, change what it does, and read what its screen shows.";
  if (product === "simple") return "Build a Simple switch for Philips Hue, set it up, change what it does, and read what its LED shows.";
  return "Build a Round or Simple switch for Philips Hue, set it up, change what it does, and read what it shows.";
}

/**
 * Old links pointed at sections of one long page (`/how-to?product=simple#status`). Returns the
 * view an old anchor stands for, and the anchor still worth scrolling to, or null when the hash
 * is not an old section anchor or the URL already names a topic. Without a switch, old links
 * showed the Round.
 */
export function fromOldAnchor(hash: string, current: HowTo): { to: HowTo; hash: string } | null {
  if (current.topic || !hash) return null;
  const product = current.product ?? "round";
  const at = (topic: Topic, keep = "", p: Product = product, level: LevelId = DEFAULT_LEVEL) => ({
    to: { product: p, topic, level },
    hash: keep,
  });
  if (hash === "setup") return at("setup");
  if (hash === "tasks") return at("tasks");
  if (hash === "status") return at("status");
  if (hash === "round" || hash === "simple") return at("status", "", hash);
  if (hash.startsWith("status-")) return at("status", hash);
  if (hash === "build") return at("build");
  if (hash === "buy") return at("build", hash);
  if (hash === "assemble") return at("build", hash, "round");
  if (hash === "try") return at("build", hash, "simple", "try");
  if (hash === "wire" || hash === "resistors") return at("build", hash, "simple", "box");
  if (hash === "in-wall" || hash === "install") return at("build", hash, "simple", "wall");
  return null;
}
