// Design tokens for OperatorOS v2 — "premium dark," not flat industrial.
// Dark stays the default (cab glare + night shifts is a real functional requirement,
// not just a style choice), but with real depth: glass surfaces, soft glows, a
// restrained accent instead of yellow-blocks-everywhere. Touch targets still meet the
// 56px glove-friendly minimum from CLAUDE.md section 6.

export const color = {
  bg: "#08090C",
  bgGlowTop: "#151A2E", // used as the top stop of the screen backdrop gradient

  // glass (hero/featured surfaces, paired with BlurView)
  glassFill: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.10)",

  // solid elevated (regular list/content cards — no blur, just soft shadow)
  surface: "#14161B",
  surfaceRaised: "#1C1F26",
  border: "rgba(255,255,255,0.08)",

  textPrimary: "#F5F6F8",
  textSecondary: "#9BA3AF",
  textMuted: "#6B7280",

  accent: "#FFC940", // CAT-adjacent yellow, used sparingly now (primary CTAs only)
  accentGlow: "rgba(255,201,64,0.35)",
  accentPressed: "#E6B330",

  info: "#7C9CFF", // premium supporting hue for native-feel glows / informational bits
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
} as const;

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

// Shared soft-shadow presets so elevation reads consistently across solid cards.
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: (glowColor: string) => ({
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  }),
} as const;
