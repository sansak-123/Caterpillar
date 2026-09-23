import { StyleSheet, Text, View } from "react-native";

import { color, radius, spacing, type } from "../theme/tokens";

export type BadgeTone = "safe" | "caution" | "danger" | "info" | "neutral";

const toneColor: Record<BadgeTone, string> = {
  safe: color.safe,
  caution: color.caution,
  danger: color.danger,
  info: color.info,
  neutral: color.textSecondary,
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const tint = toneColor[tone];
  return (
    <View style={[styles.badge, { borderColor: tint, backgroundColor: `${tint}1F` }]}>
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
    paddingHorizontal: spacing.sm,
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
