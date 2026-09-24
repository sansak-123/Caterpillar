// Design tokens for OperatorOS — CAT-branded, light-mode-first with a dark-mode toggle.
// Visual language follows the reference redesign: a warm cream page, flat off-white
// cards with hairline borders (almost no shadow), tight 6–10 px corners, CAT yellow as
// the single strong accent for primary actions, and soft tinted status pills. Dark mode
// stays a full toggle for cab glare and night shifts (CLAUDE.md section 6).
//
// Components read colors via `useColors()` (src/theme/useColors.ts), never this file's
// exports directly, so every screen repaints correctly when the mode toggles.

export interface ColorTokens {
  mode: "light" | "dark";
  bg: string;
  bgGlowTop: string;
  glassFill: string;
  glassBorder: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  sidebar: string;
  navActive: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentOn: string;
  accentGlow: string;
  accentPressed: string;
  accentSoft: string;
  primaryDark: string;
  primaryDarkOn: string;
  hero: string;
  heroText: string;
  info: string;
  infoGlow: string;
  infoSoft: string;
  safe: string;
  safeGlow: string;
  safeSoft: string;
  caution: string;
  cautionGlow: string;
  cautionSoft: string;
  danger: string;
  dangerGlow: string;
  dangerSoft: string;
  online: string;
  offline: string;
  syncing: string;
  ringTrack: string;
}

const catYellow = "#F7C600"; // CAT-brand yellow (matches the reference UI's primary buttons)
const catBlack = "#1C1A17"; // warm near-black used for text on yellow

// Warm-paper light theme from the reference design: cream page, off-white bordered
// cards, very little shadow, CAT yellow as the single strong accent.
export const lightColors: ColorTokens = {
  mode: "light",
  bg: "#F4F1EA",
  bgGlowTop: "#F4F1EA",

  glassFill: "#FCFBF8",
  glassBorder: "rgba(28,26,23,0.10)",

  surface: "#FCFBF8",
  surfaceRaised: "#EFEBE2",
  surfaceSunken: "#F7F5F0",
  sidebar: "#F8F6F1",
  navActive: "#FAEDC2",
  border: "rgba(28,26,23,0.10)",
  borderStrong: "rgba(28,26,23,0.18)",

  textPrimary: "#1C1A17",
  textSecondary: "#57534C",
  textMuted: "#8A857C",

  accent: catYellow,
  accentOn: catBlack,
  accentGlow: "rgba(247,198,0,0.35)",
  accentPressed: "#E3B500",
  accentSoft: "#FBF0C9",

  primaryDark: catBlack,
  primaryDarkOn: "#FFFFFF",

  hero: "#1E1A12",
  heroText: "#F7C600",

  info: "#2F5FBF",
  infoGlow: "rgba(47,95,191,0.18)",
  infoSoft: "#E3EAF7",

  safe: "#1E7A46",
  safeGlow: "rgba(30,122,70,0.18)",
  safeSoft: "#DCEFE2",
  caution: "#A8660B",
  cautionGlow: "rgba(168,102,11,0.18)",
  cautionSoft: "#FBF0D0",
  danger: "#C62828",
  dangerGlow: "rgba(198,40,40,0.18)",
  dangerSoft: "#FBE4E1",

  online: "#1E7A46",
  offline: "#C62828",
  syncing: "#A8660B",

  ringTrack: "rgba(28,26,23,0.08)",
};

// Dark mode stays a first-class toggle for cab glare / night shifts (CLAUDE.md §6) —
// same flat bordered language as light, warm charcoal instead of cream.
export const darkColors: ColorTokens = {
  mode: "dark",
  bg: "#12110F",
  bgGlowTop: "#12110F",

  glassFill: "#1B1A17",
  glassBorder: "rgba(255,255,255,0.09)",

  surface: "#1B1A17",
  surfaceRaised: "#262420",
  surfaceSunken: "#171613",
  sidebar: "#161512",
  navActive: "#3A3218",
  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(255,255,255,0.16)",

  textPrimary: "#F4F1EA",
  textSecondary: "#BDB7AC",
  textMuted: "#8A857C",

  accent: catYellow,
  accentOn: catBlack,
  accentGlow: "rgba(247,198,0,0.30)",
  accentPressed: "#E3B500",
  accentSoft: "#3A3218",

  primaryDark: "#F4F1EA",
  primaryDarkOn: catBlack,

  hero: "#0B0A08",
  heroText: "#F7C600",

  info: "#8AA8F0",
  infoGlow: "rgba(138,168,240,0.22)",
  infoSoft: "#1F2638",

  safe: "#4CC38A",
  safeGlow: "rgba(76,195,138,0.22)",
  safeSoft: "#15291F",
  caution: "#F0A94B",
  cautionGlow: "rgba(240,169,75,0.22)",
  cautionSoft: "#32260F",
  danger: "#FF6B63",
  dangerGlow: "rgba(255,107,99,0.24)",
  dangerSoft: "#3A1A18",

  online: "#4CC38A",
  offline: "#FF6B63",
  syncing: "#F0A94B",

  ringTrack: "rgba(255,255,255,0.10)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Tight, flat corners per the reference design — cards and buttons read as crisp
// panels rather than soft bubbles.
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 999,
} as const;

// Per-weight Inter family names (loaded via useFonts in app/_layout.tsx) rather than a
// single family + numeric fontWeight — Android ignores fontWeight on a custom
// fontFamily unless the family itself is the weight-specific file, so the weight
// really is the font choice here, not a style override on top of it.
export const type = {
  display: { fontFamily: "Inter_800ExtraBold", fontSize: 30, letterSpacing: -0.8 },
  h1: { fontFamily: "Inter_800ExtraBold", fontSize: 24, letterSpacing: -0.5 },
  h2: { fontFamily: "Inter_700Bold", fontSize: 17, letterSpacing: -0.2 },
  metric: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.5 },
  body: { fontFamily: "Inter_400Regular", fontSize: 15 },
  bodyStrong: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  caption: { fontFamily: "Inter_500Medium", fontSize: 13 },
  small: { fontFamily: "Inter_500Medium", fontSize: 12 },
  label: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1 },
} as const;

// Minimum interactive dimension for a gloved finger, per CLAUDE.md section 6.
export const touchTarget = 56;

// Shared soft-shadow presets — same shape in both themes, just a darker shadow color
// reads correctly on a light backdrop while a colored glow reads correctly on dark.
export const shadow = {
  card: (mode: "light" | "dark") => ({
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: mode === "light" ? 0.04 : 0.25,
    shadowRadius: 3,
    elevation: 1,
  }),
  glow: (glowColor: string) => ({
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  }),
} as const;

// Width at which the app switches from the phone layout (bottom tabs) to the desktop /
// in-cab tablet layout (left sidebar + top bar + multi-column pages).
export const WIDE_BREAKPOINT = 900;

// Max content width for a page on wide screens, matching the reference layout's
// centered column.
export const PAGE_MAX_WIDTH = 1080;
