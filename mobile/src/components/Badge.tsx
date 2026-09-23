import { StyleSheet, Text, View } from "react-native";

import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";

export type BadgeTone = "safe" | "caution" | "danger" | "info" | "neutral";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const colors = useColors();
  const toneColor: Record<BadgeTone, string> = {
    safe: colors.safe,
    caution: colors.caution,
    danger: colors.danger,
    info: colors.info,
    neutral: colors.textSecondary,
  };
  const glowColor: Record<BadgeTone, string | null> = {
    safe: colors.safeGlow,
    caution: colors.cautionGlow,
    danger: colors.dangerGlow,
    info: colors.infoGlow,
    neutral: null,
  };
  const tint = toneColor[tone];
  const glow = glowColor[tone];

  return (
    <View
      style={[
        styles.badge,
        { borderColor: `${tint}40`, backgroundColor: `${tint}17` },
        glow ? { shadowColor: glow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } } : null,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[type.label, styles.text, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    textTransform: "uppercase",
  },
});
