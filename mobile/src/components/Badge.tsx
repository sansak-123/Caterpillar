import { StyleSheet, Text, View } from "react-native";

import { useColors } from "../theme/useColors";
import { radius, spacing } from "../theme/tokens";

export type BadgeTone = "safe" | "caution" | "danger" | "info" | "neutral";

// Soft tinted status pill with a leading dot ("● Needs review"), sentence case.
export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const colors = useColors();
  const fg: Record<BadgeTone, string> = {
    safe: colors.safe,
    caution: colors.caution,
    danger: colors.danger,
    info: colors.info,
    neutral: colors.textSecondary,
  };
  const bg: Record<BadgeTone, string> = {
    safe: colors.safeSoft,
    caution: colors.cautionSoft,
    danger: colors.dangerSoft,
    info: colors.infoSoft,
    neutral: colors.surfaceRaised,
  };
  const text = label.length ? label.charAt(0).toUpperCase() + label.slice(1) : label;

  return (
    <View style={[styles.badge, { backgroundColor: bg[tone] }]}>
      <View style={[styles.dot, { backgroundColor: fg[tone] }]} />
      <Text style={[styles.text, { color: fg[tone] }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11.5,
  },
});
