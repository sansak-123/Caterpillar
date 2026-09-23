// Design tokens for OperatorOS. Dark theme is the default (cab glare + night shifts);
// touch targets meet the 56px glove-friendly minimum from CLAUDE.md section 6.

export const color = {
  bg: "#101214",
  surface: "#1B1E22",
  surfaceRaised: "#24282D",
  border: "#33383F",

  textPrimary: "#F5F6F7",
  textSecondary: "#A7AEB6",
  textMuted: "#6E747C",

  accent: "#FFC72C", // safety-yellow, CAT-adjacent, used sparingly for primary actions
  accentPressed: "#E0AC1F",

  safe: "#2ECC71", // green zone / good status
  caution: "#F5A623", // amber zone / soft warning
  danger: "#E5473A", // red zone / hard alert
  info: "#4FA3E3",

  online: "#2ECC71",
  offline: "#E5473A",
  syncing: "#F5A623",
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
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: "700" as const },
  h2: { fontSize: 20, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, fontWeight: "600" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5 },
} as const;

// Minimum interactive dimension for a gloved finger, per CLAUDE.md section 6.
export const touchTarget = 56;
