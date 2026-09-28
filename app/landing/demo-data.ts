import { ROUND_THEMES, type RoundTheme, type RoundThemeId } from "@/lib/round-themes";

// Data behind the switch demos on the signed-out home page. Gesture timings follow the
// firmware: 240 ms double-tap window, 420 ms hold. Device colours are fixed, not theme tokens.

export const DOUBLE_MS = 240;
export const HOLD_MS = 420;

function palette(id: RoundThemeId): RoundTheme {
  return ROUND_THEMES.find((t) => t.id === id) ?? ROUND_THEMES[0];
}

// Each Round page has its own screen theme (docs/definitions.md).
export const PAGES = [
  { name: "Living", scenes: ["Sunset", "Aurora", "Relax", "Read"], pal: palette("ember") },
  { name: "Kitchen", scenes: ["Bright", "Lagoon", "Dimmed"], pal: palette("ocean") },
  { name: "Bedroom", scenes: ["Neon", "Nightlight", "Relax"], pal: palette("violet") },
];
export const SIMPLE_SCENES = ["Bright", "Tropics", "Nightlight"];

// Whites are one colour; colour scenes are a palette spread over the lights in the room.
export const SCENE_COLOURS: Record<string, string[]> = {
  Relax: ["255 172 92"],
  Read: ["255 222 176"],
  Bright: ["255 238 212"],
  Dimmed: ["255 186 120"],
  Nightlight: ["255 120 40"],
  Sunset: ["255 128 52", "255 64 112", "176 64 210"],
  Aurora: ["40 220 160", "64 132 255", "168 88 255"],
  Lagoon: ["0 196 224", "36 112 255", "110 240 196"],
  Neon: ["255 40 160", "118 56 255", "0 196 255"],
  Tropics: ["255 176 0", "255 72 96", "0 200 170"],
};
export const SPOTS = ["18% -12%", "82% -12%", "50% 118%"];

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type RoundState = { page: number; on: boolean; level: number; scene: number };

export function roundReadout(s: RoundState): string {
  const page = PAGES[s.page];
  return `→ ${page.name} · ${s.on ? `${page.scenes[s.scene]} · ${s.level}%` : "off"}`;
}

// Same arithmetic as the firmware's ring: 270° of travel starting at 225°.
export function ringLevel(dx: number, dy: number): number {
  const a = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  let rel = (a - 225 + 360) % 360;
  if (rel > 270) rel = rel > 315 ? 0 : 270;
  return Math.round((rel / 270) * 100);
}
