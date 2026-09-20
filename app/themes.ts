export const THEME_STORAGE_KEY = "hsw-theme";

export const THEMES = [
  { id: "ember", name: "Ember", blurb: "Charcoal, copper", group: "dark" },
  { id: "graphite", name: "Graphite", blurb: "Zinc, champagne", group: "dark" },
  { id: "night", name: "Night", blurb: "OLED, electric amber", group: "dark" },
  { id: "ink", name: "Ink", blurb: "Blue-black, teal", group: "dark" },
  { id: "plum", name: "Plum", blurb: "Espresso, rose", group: "dark" },
  { id: "matrix", name: "Matrix", blurb: "Black, phosphor green", group: "dark" },
  { id: "nord", name: "Nord", blurb: "Polar night, frost", group: "dark" },
  { id: "dracula", name: "Dracula", blurb: "Purple, pink", group: "dark" },
  { id: "ocean", name: "Ocean", blurb: "Navy, sky cyan", group: "dark" },
  { id: "paper", name: "Paper", blurb: "Cream, filament", group: "light" },
  { id: "snow", name: "Snow", blurb: "Cool white, blue", group: "light" },
  { id: "mist", name: "Mist", blurb: "Gray, slate", group: "light" },
  { id: "meadow", name: "Meadow", blurb: "Sage, leaf", group: "light" },
  { id: "porcelain", name: "Porcelain", blurb: "Blush, rose", group: "light" },
  { id: "sky", name: "Sky", blurb: "Pale blue, azure", group: "light" },
  { id: "linen", name: "Linen", blurb: "Ivory, olive", group: "light" },
  { id: "phosphor", name: "Phosphor", blurb: "Mint paper, matrix green", group: "light" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "ember";

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
