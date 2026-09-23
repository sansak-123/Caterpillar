// Design tokens for OperatorOS v3 — CAT-branded, light-mode-first with a dark mode
// toggle. Light is the default per direct design feedback (soft warm-white cards,
// generous rounded corners, soft shadows, CAT yellow/black as the brand accent, not a
// flat industrial dark app). Dark mode is kept as a full, equally-designed toggle for
// the real functional case CLAUDE.md section 6 calls out — cab glare and night shifts
// — not dropped, just no longer forced on everyone by default.
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
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentOn: string;
  accentGlow: string;
  accentPressed: string;
  primaryDark: string;
  primaryDarkOn: string;
  info: string;
  infoGlow: string;
  safe: string;
  safeGlow: string;
  caution: string;
  cautionGlow: string;
  danger: string;
  dangerGlow: string;
  online: string;
  offline: string;
  syncing: string;
  ringTrack: string;
}

const catYellow = "#FFC72C"; // CAT-brand yellow
const catBlack = "#1A1A1A"; // CAT-brand black, used as the solid primary-button color

export const lightColors: ColorTokens = {
  mode: "light",
  bg: "#F6F4EF", // warm off-white, not stark white
  bgGlowTop: "#FFF3D6", // subtle warm-yellow top-of-screen glow

  // "insight"/hero tier — soft warm-tinted card, no blur needed on a light backdrop
  glassFill: "#FFF7E2",
  glassBorder: "rgba(255,199,44,0.35)",

  // regular content cards — solid white, soft shadow does the elevation work
  surface: "#FFFFFF",
  surfaceRaised: "#EFEDE7",
  border: "rgba(20,20,20,0.07)",

  textPrimary: "#16171A",
  textSecondary: "#5B5E66",
  textMuted: "#8A8D94",

  accent: catYellow,
  accentOn: catBlack, // text/icon color when sitting on top of accent yellow
  accentGlow: "rgba(255,199,44,0.45)",
  accentPressed: "#E6B026",

  primaryDark: catBlack, // the solid black pill (CTA) from the reference design
  primaryDarkOn: "#FFFFFF",

  info: "#3B6FE0",
  infoGlow: "rgba(59,111,224,0.25)",

  safe: "#15803D",
  safeGlow: "rgba(21,128,61,0.22)",
  caution: "#B45309",
  cautionGlow: "rgba(180,83,9,0.22)",
  danger: "#DC2626",
  dangerGlow: "rgba(220,38,38,0.24)",

  online: "#15803D",
  offline: "#DC2626",
  syncing: "#B45309",

  ringTrack: "rgba(20,20,20,0.08)",
};

export const darkColors: ColorTokens = {
  mode: "dark",
  bg: "#08090C",
  bgGlowTop: "#151A2E",

  glassFill: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.10)",

  surface: "#14161B",
  surfaceRaised: "#1C1F26",
  border: "rgba(255,255,255,0.08)",

  textPrimary: "#F5F6F8",
  textSecondary: "#9BA3AF",
  textMuted: "#6B7280",

  accent: catYellow,
  accentOn: catBlack,
  accentGlow: "rgba(255,199,44,0.35)",
  accentPressed: "#E6B026",

  primaryDark: "#F5F6F8",
  primaryDarkOn: catBlack,

  info: "#7C9CFF",
  infoGlow: "rgba(124,156,255,0.30)",

  safe: "#34D399",
  safeGlow: "rgba(52,211,153,0.28)",
  caution: "#FB923C",
  cautionGlow: "rgba(251,146,60,0.28)",
  danger: "#FF5A5F",
  dangerGlow: "rgba(255,90,95,0.32)",

  online: "#34D399",
  offline: "#FF5A5F",
  syncing: "#FB923C",

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

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.6 },
  h1: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, fontWeight: "600" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
  label: { fontSize: 11.5, fontWeight: "700" as const, letterSpacing: 0.8 },
} as const;

// Minimum interactive dimension for a gloved finger, per CLAUDE.md section 6.
export const touchTarget = 56;

// Shared soft-shadow presets — same shape in both themes, just a darker shadow color
// reads correctly on a light backdrop while a colored glow reads correctly on dark.
export const shadow = {
  card: (mode: "light" | "dark") => ({
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: mode === "light" ? 6 : 8 },
    shadowOpacity: mode === "light" ? 0.08 : 0.35,
    shadowRadius: mode === "light" ? 14 : 16,
    elevation: 4,
  }),
  glow: (glowColor: string) => ({
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  }),
} as const;
