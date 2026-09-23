import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { color, radius, shadow, spacing } from "../theme/tokens";

// Reserved for the one or two featured surfaces per screen (hero cards, the live
// safety alert) — a frosted-glass tier that sits visually above the regular solid
// Card tier, so the hierarchy of "this matters most right now" is felt, not just read.
export function GlassCard({
  children,
  style,
  glowColor,
}: PropsWithChildren<{ style?: ViewStyle; glowColor?: string }>) {
  return (
    <View style={[glowColor ? shadow.glow(glowColor) : shadow.card, style]}>
      <BlurView intensity={40} tint="dark" style={styles.blur}>
        <View style={styles.fill}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  fill: {
    backgroundColor: color.glassFill,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
