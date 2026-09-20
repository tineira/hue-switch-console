export const THEME_STORAGE_KEY = "hsw-theme";

export const THEMES = [
  { id: "paper", name: "Paper", blurb: "Warm cream (current)" },
  { id: "ember", name: "Ember", blurb: "Charcoal, copper" },
  { id: "graphite", name: "Graphite", blurb: "Zinc, champagne" },
  { id: "night", name: "Night", blurb: "OLED, electric amber" },
  { id: "ink", name: "Ink", blurb: "Blue-black, teal" },
  { id: "plum", name: "Plum", blurb: "Espresso, rose" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "ember";

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
