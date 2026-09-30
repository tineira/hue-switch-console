export const THEME_STORAGE_KEY = "hsw-theme";

// Slate and Slate Light are the defaults; Matrix is ours; the rest follow Omarchy's themes
// (github.com/basecamp/omarchy, MIT). Tokens are in app/globals.css, chosen in docs/theme-preview.html.
export const THEMES = [
  {
    id: "slate",
    name: "Slate",
    blurb: "Blue-gray, orange · default",
    group: "dark",
    colors: ["#0b0e13", "#131820", "#ff9f1c", "#e9edf3"],
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    blurb: "Indigo night, blue",
    group: "dark",
    colors: ["#1a1b26", "#24283b", "#7aa2f7", "#c0caf5"],
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    blurb: "Mocha, soft blue",
    group: "dark",
    colors: ["#181825", "#1e1e2e", "#89b4fa", "#cdd6f4"],
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    blurb: "Retro brown, aqua",
    group: "dark",
    colors: ["#282828", "#32302f", "#7daea3", "#d4be98"],
  },
  {
    id: "everforest",
    name: "Everforest",
    blurb: "Forest gray, sage",
    group: "dark",
    colors: ["#2d353b", "#343f44", "#7fbbb3", "#d3c6aa"],
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    blurb: "Ink wash, crystal blue",
    group: "dark",
    colors: ["#1f1f28", "#2a2a37", "#7e9cd8", "#dcd7ba"],
  },
  {
    id: "nord",
    name: "Nord",
    blurb: "Polar night, frost",
    group: "dark",
    colors: ["#2e3440", "#3b4252", "#88c0d0", "#eceff4"],
  },
  {
    id: "matte-black",
    name: "Matte Black",
    blurb: "Flat black, amber",
    group: "dark",
    colors: ["#121212", "#1e1e1e", "#e68e0d", "#d4d4d4"],
  },
  {
    id: "osaka-jade",
    name: "Osaka Jade",
    blurb: "Deep jade, teal",
    group: "dark",
    colors: ["#111c18", "#1a2a23", "#2dd5b7", "#d6d5bc"],
  },
  {
    id: "ristretto",
    name: "Ristretto",
    blurb: "Espresso, peach",
    group: "dark",
    colors: ["#2c2525", "#3a3030", "#f38d70", "#e6d9db"],
  },
  {
    id: "matrix",
    name: "Matrix",
    blurb: "Black, phosphor green",
    group: "dark",
    colors: ["#020402", "#071208", "#00ff41", "#d0ffd4"],
  },
  {
    id: "slate-light",
    name: "Slate Light",
    blurb: "Cool white, orange · default",
    group: "light",
    colors: ["#f3f5f8", "#ffffff", "#b85209", "#141a24"],
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    blurb: "Pale lilac, blue",
    group: "light",
    colors: ["#e6e9ef", "#eff1f5", "#1e66f5", "#4c4f69"],
  },
  {
    id: "flexoki-light",
    name: "Flexoki Light",
    blurb: "Warm paper, ink blue",
    group: "light",
    colors: ["#f2f0e5", "#fffcf0", "#205ea6", "#100f0f"],
  },
  {
    id: "rose-pine",
    name: "Rosé Pine Dawn",
    blurb: "Dawn blush, pine",
    group: "light",
    colors: ["#f2e9e1", "#fffaf3", "#286983", "#575279"],
  },
] as const;

// Themes that were retired, mapped to the closest one still offered, in the same scheme so nobody
// flips between dark and light. Stored ids are mapped when read, here and in the boot script in
// app/layout.tsx.
export const RETIRED_THEMES: Record<string, ThemeId> = {
  ember: "ristretto",
  graphite: "matte-black",
  night: "matte-black",
  ink: "tokyo-night",
  ocean: "tokyo-night",
  plum: "catppuccin",
  dracula: "catppuccin",
  paper: "flexoki-light",
  linen: "flexoki-light",
  meadow: "flexoki-light",
  porcelain: "rose-pine",
  snow: "slate-light",
  sky: "slate-light",
  mist: "slate-light",
  phosphor: "slate-light",
};

export type ThemeId = (typeof THEMES)[number]["id"];
export type Scheme = "dark" | "light";

// No stored choice: follow the system setting. Slate Light is what the server renders (and what shows without JS).
export const DEFAULT_THEME: ThemeId = "slate-light";
export const DEFAULT_DARK_THEME: ThemeId = "slate";

export const DARK_THEME_IDS: string[] = THEMES.filter((theme) => theme.group === "dark").map((theme) => theme.id);

// The last theme chosen in each scheme, so a dark/light toggle returns to it.
export function schemeStorageKey(scheme: Scheme) {
  return `${THEME_STORAGE_KEY}-${scheme}`;
}

export function schemeOf(id: ThemeId): Scheme {
  return DARK_THEME_IDS.includes(id) ? "dark" : "light";
}

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

// A stored id, with a retired theme mapped to its replacement.
function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value !== null && value in RETIRED_THEMES ? RETIRED_THEMES[value] : value;
  } catch {
    return null;
  }
}

// The stored theme, else the system default.
export function currentTheme(): ThemeId {
  const stored = read(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : systemTheme();
}

// The theme a dark/light toggle switches to: the last one used in the other scheme, else its default.
export function oppositeTheme(id: ThemeId): ThemeId {
  const scheme: Scheme = schemeOf(id) === "dark" ? "light" : "dark";
  const stored = read(schemeStorageKey(scheme));
  return isThemeId(stored) && schemeOf(stored) === scheme
    ? stored
    : scheme === "dark"
      ? DEFAULT_DARK_THEME
      : DEFAULT_THEME;
}

// data-scheme lets CSS style every dark or every light theme without listing them.
export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  root.setAttribute("data-scheme", schemeOf(id));
}

export function chooseTheme(id: ThemeId) {
  // Remember the theme being left too, so a choice made before per-scheme keys existed survives a toggle.
  const previous = document.documentElement.getAttribute("data-theme");
  applyTheme(id);
  try {
    if (isThemeId(previous)) localStorage.setItem(schemeStorageKey(schemeOf(previous)), previous);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    localStorage.setItem(schemeStorageKey(schemeOf(id)), id);
  } catch {}
}
