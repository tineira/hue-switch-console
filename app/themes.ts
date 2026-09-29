export const THEME_STORAGE_KEY = "hsw-theme";

export const THEMES = [
  {
    id: "ember",
    name: "Ember",
    blurb: "Charcoal, copper",
    group: "dark",
    colors: ["#14110f", "#1e1a17", "#e07a3d", "#f4eee6"],
  },
  {
    id: "graphite",
    name: "Graphite",
    blurb: "Zinc, champagne",
    group: "dark",
    colors: ["#121314", "#1c1d1f", "#d4b483", "#ececec"],
  },
  {
    id: "night",
    name: "Night",
    blurb: "OLED, electric amber",
    group: "dark",
    colors: ["#070708", "#111114", "#ffb020", "#f2f2f0"],
  },
  {
    id: "ink",
    name: "Ink",
    blurb: "Blue-black, teal",
    group: "dark",
    colors: ["#0b1016", "#121a24", "#3dd6c6", "#e8eef6"],
  },
  {
    id: "plum",
    name: "Plum",
    blurb: "Espresso, rose",
    group: "dark",
    colors: ["#140f14", "#1d161d", "#e8a0b4", "#f3e8ee"],
  },
  {
    id: "matrix",
    name: "Matrix",
    blurb: "Black, phosphor green",
    group: "dark",
    colors: ["#020402", "#071208", "#00ff41", "#d0ffd4"],
  },
  {
    id: "nord",
    name: "Nord",
    blurb: "Polar night, frost",
    group: "dark",
    colors: ["#2e3440", "#3b4252", "#88c0d0", "#eceff4"],
  },
  {
    id: "dracula",
    name: "Dracula",
    blurb: "Purple, pink",
    group: "dark",
    colors: ["#1e1f29", "#282a36", "#bd93f9", "#f8f8f2"],
  },
  {
    id: "ocean",
    name: "Ocean",
    blurb: "Navy, sky cyan",
    group: "dark",
    colors: ["#071018", "#0d1b28", "#38bdf8", "#dceef8"],
  },
  {
    id: "paper",
    name: "Paper",
    blurb: "Cream, filament",
    group: "light",
    colors: ["#f3eee4", "#fffaf2", "#c45c26", "#1c1814"],
  },
  {
    id: "snow",
    name: "Snow",
    blurb: "Cool white, blue",
    group: "light",
    colors: ["#f4f6f8", "#ffffff", "#2563eb", "#1a2330"],
  },
  {
    id: "mist",
    name: "Mist",
    blurb: "Gray, slate",
    group: "light",
    colors: ["#eef0f2", "#ffffff", "#4b5563", "#1f2328"],
  },
  {
    id: "meadow",
    name: "Meadow",
    blurb: "Sage, leaf",
    group: "light",
    colors: ["#eef3e8", "#f7fbf3", "#3f7a4a", "#1c2418"],
  },
  {
    id: "porcelain",
    name: "Porcelain",
    blurb: "Blush, rose",
    group: "light",
    colors: ["#f6f1f3", "#fffafb", "#c45c78", "#2a1c22"],
  },
  {
    id: "sky",
    name: "Sky",
    blurb: "Pale blue, azure",
    group: "light",
    colors: ["#eaf3f8", "#f7fcff", "#0284c7", "#152030"],
  },
  {
    id: "linen",
    name: "Linen",
    blurb: "Ivory, olive",
    group: "light",
    colors: ["#f3efe4", "#fbf8f0", "#6b7a3a", "#242018"],
  },
  {
    id: "phosphor",
    name: "Phosphor",
    blurb: "Mint paper, matrix green",
    group: "light",
    colors: ["#e8f5e9", "#f4fbf4", "#15803d", "#0b2e14"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

// No stored choice: follow the system setting. Paper is what the server renders (and what shows without JS).
export const DEFAULT_THEME: ThemeId = "paper";
export const DEFAULT_DARK_THEME: ThemeId = "ember";

export function systemTheme(): ThemeId {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? DEFAULT_DARK_THEME : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
