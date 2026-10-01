export const ROUND_THEME_IDS = [
  "ember",
  "night",
  "coal",
  "graphite",
  "ink",
  "ocean",
  "nord",
  "plum",
  "violet",
  "dracula",
  "matrix",
  "forest",
  "copper",
  "snow",
  "paper",
  "sand",
  "linen",
  "meadow",
  "sky",
  "porcelain",
] as const;

export type RoundThemeId = (typeof ROUND_THEME_IDS)[number];

export type RoundTheme = {
  id: RoundThemeId;
  name: string;
  blurb: string;
  bg: string;
  ink: string;
  mute: string;
  fillOn: string;
  fillOff: string;
  accent: string;
  track: string;
  error: string;
};

export const ROUND_THEMES: RoundTheme[] = [
  {
    id: "ember",
    name: "Ember",
    blurb: "Current firmware. Charcoal, amber.",
    bg: "#101410",
    ink: "#eee8e0",
    mute: "#7c7a74",
    fillOn: "#a54a00",
    fillOff: "#212021",
    accent: "#ff9e00",
    track: "#313131",
    error: "#f80000",
  },
  {
    id: "night",
    name: "Night",
    blurb: "OLED black, electric amber.",
    bg: "#050506",
    ink: "#f4f1ea",
    mute: "#d8cfc4",
    fillOn: "#c47a10",
    fillOff: "#121214",
    accent: "#ffb020",
    track: "#2a2a22",
    error: "#ff5555",
  },
  {
    id: "coal",
    name: "Coal",
    blurb: "Almost off. Faint ember ring.",
    bg: "#0a0a0a",
    ink: "#d8d0c8",
    mute: "#6a6660",
    fillOn: "#5c2e12",
    fillOff: "#161616",
    accent: "#c45c18",
    track: "#242424",
    error: "#c04040",
  },
  {
    id: "graphite",
    name: "Graphite",
    blurb: "Zinc, champagne.",
    bg: "#121314",
    ink: "#ecece8",
    mute: "#9a9ca0",
    fillOn: "#6a5a40",
    fillOff: "#1c1d1f",
    accent: "#d4b483",
    track: "#2e3035",
    error: "#d9897c",
  },
  {
    id: "ink",
    name: "Ink",
    blurb: "Blue-black, teal.",
    bg: "#0b1016",
    ink: "#e8eef6",
    mute: "#8fa0b5",
    fillOn: "#0e4a48",
    fillOff: "#121a24",
    accent: "#3dd6c6",
    track: "#243040",
    error: "#f07a72",
  },
  {
    id: "ocean",
    name: "Ocean",
    blurb: "Navy, sky cyan.",
    bg: "#071018",
    ink: "#dceef8",
    mute: "#7fa3bb",
    fillOn: "#0a4a6a",
    fillOff: "#0d1b28",
    accent: "#38bdf8",
    track: "#1c3348",
    error: "#fb7185",
  },
  {
    id: "nord",
    name: "Nord",
    blurb: "Polar night, frost.",
    bg: "#2e3440",
    ink: "#eceff4",
    mute: "#a0a8b8",
    fillOn: "#4c566a",
    fillOff: "#3b4252",
    accent: "#88c0d0",
    track: "#434c5e",
    error: "#bf616a",
  },
  {
    id: "plum",
    name: "Plum",
    blurb: "Espresso, rose.",
    bg: "#140f14",
    ink: "#f3e8ee",
    mute: "#b39aa8",
    fillOn: "#6a3048",
    fillOff: "#1d161d",
    accent: "#e8a0b4",
    track: "#3a2c36",
    error: "#e07a7a",
  },
  {
    id: "violet",
    name: "Violet",
    blurb: "Deep purple, lavender.",
    bg: "#120e18",
    ink: "#f0e8ff",
    mute: "#a090b8",
    fillOn: "#4a3470",
    fillOff: "#1a1524",
    accent: "#c4a0ff",
    track: "#322848",
    error: "#ff6a8a",
  },
  {
    id: "dracula",
    name: "Dracula",
    blurb: "Purple, pink.",
    bg: "#1e1f29",
    ink: "#f8f8f2",
    mute: "#b0b3c8",
    fillOn: "#5a3d78",
    fillOff: "#282a36",
    accent: "#bd93f9",
    track: "#44475a",
    error: "#ff5555",
  },
  {
    id: "matrix",
    name: "Matrix",
    blurb: "Black, phosphor green.",
    bg: "#020402",
    ink: "#d0ffd4",
    mute: "#5f9e68",
    fillOn: "#0a3a14",
    fillOff: "#071208",
    accent: "#00ff41",
    track: "#1a3d1e",
    error: "#ff4d4d",
  },
  {
    id: "forest",
    name: "Forest",
    blurb: "Dark green, gold.",
    bg: "#0c120e",
    ink: "#e8f0e6",
    mute: "#8fa88c",
    fillOn: "#3a4a18",
    fillOff: "#151e17",
    accent: "#c9a227",
    track: "#2a3a2c",
    error: "#e07a6a",
  },
  {
    id: "copper",
    name: "Copper",
    blurb: "Warm metal, rust.",
    bg: "#16100c",
    ink: "#f4ece4",
    mute: "#b09078",
    fillOn: "#8a4020",
    fillOff: "#241810",
    accent: "#e07a3d",
    track: "#3a2a20",
    error: "#e06050",
  },
  {
    id: "snow",
    name: "Snow",
    blurb: "Cool white, blue.",
    bg: "#e8eef4",
    ink: "#1a2330",
    mute: "#5c6b7a",
    fillOn: "#c5d8f0",
    fillOff: "#f4f6f8",
    accent: "#2563eb",
    track: "#c8d4e0",
    error: "#b42318",
  },
  {
    id: "paper",
    name: "Paper",
    blurb: "Cream, filament.",
    bg: "#e8e0d4",
    ink: "#1c1814",
    mute: "#6e675c",
    fillOn: "#e8c4a0",
    fillOff: "#f3eee4",
    accent: "#c45c26",
    track: "#d4c8b8",
    error: "#a33b2a",
  },
  {
    id: "sand",
    name: "Sand",
    blurb: "Warm beige, terracotta.",
    bg: "#e8dcc8",
    ink: "#2a2118",
    mute: "#7a6a58",
    fillOn: "#e0b090",
    fillOff: "#f4ecdf",
    accent: "#b85c38",
    track: "#d4c4a8",
    error: "#a33b2a",
  },
  {
    id: "linen",
    name: "Linen",
    blurb: "Ivory, olive.",
    bg: "#e6e2d4",
    ink: "#2a2a1c",
    mute: "#6e6e58",
    fillOn: "#c8c4a0",
    fillOff: "#f2efe4",
    accent: "#6a7a38",
    track: "#d0ccb8",
    error: "#a04030",
  },
  {
    id: "meadow",
    name: "Meadow",
    blurb: "Sage, leaf.",
    bg: "#dce8d8",
    ink: "#1c2a1c",
    mute: "#5a7058",
    fillOn: "#a8c898",
    fillOff: "#e8f0e4",
    accent: "#3d8a4a",
    track: "#c0d4bc",
    error: "#b04030",
  },
  {
    id: "sky",
    name: "Sky",
    blurb: "Pale blue, azure.",
    bg: "#d4e4f0",
    ink: "#183040",
    mute: "#5a7088",
    fillOn: "#a0c8e8",
    fillOff: "#e8f2f8",
    accent: "#2a8ad4",
    track: "#b8d0e0",
    error: "#c04040",
  },
  {
    id: "porcelain",
    name: "Porcelain",
    blurb: "Blush, rose.",
    bg: "#f0e4e4",
    ink: "#3a2028",
    mute: "#8a6870",
    fillOn: "#e8b8c0",
    fillOff: "#f8eeee",
    accent: "#c45a70",
    track: "#e0c8cc",
    error: "#b03030",
  },
];

export const DEFAULT_ROUND_THEME: RoundThemeId = "ember";
export const MAX_ROUND_PAGES = 6;
export const MAX_SCENE_LIST = 8;
export const PAGE_NAME_MAX = 12;

/**
 * Non-ASCII characters the Round's built-in 5×7 font can draw (code page 437 glyphs).
 * Everything else folds to its base letter or is dropped. Must match the firmware's table:
 * docs/specs/round-accented-names.md §2.
 */
export const ROUND_CIRCLE_CHARS = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜáíóúñÑ¿¡ß";

export function isRoundThemeId(value: string): value is RoundThemeId {
  return (ROUND_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeRoundTheme(value: string | null | undefined): RoundThemeId {
  return value && isRoundThemeId(value) ? value : DEFAULT_ROUND_THEME;
}

export function roundThemeById(id: string): RoundTheme {
  return ROUND_THEMES.find((theme) => theme.id === id) ?? ROUND_THEMES[0];
}
