import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { useColors } from "../theme/useColors";
import { radius, shadow, spacing } from "../theme/tokens";

// Reserved for the one or two featured surfaces per screen (hero cards, the live
// safety alert) — a tier that sits visually above the regular solid Card, so the
// hierarchy of "this matters most right now" is felt, not just read.
export function GlassCard({
  children,
  style,
  glowColor,
}: PropsWithChildren<{ style?: ViewStyle; glowColor?: string }>) {
  const colors = useColors();
  return (
    <View style={[glowColor ? shadow.glow(glowColor) : shadow.card(colors.mode), style]}>
      <BlurView intensity={colors.mode === "light" ? 60 : 40} tint={colors.mode} style={styles.blur}>
        <View style={[styles.fill, { backgroundColor: colors.glassFill, borderColor: colors.glassBorder }]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  fill: {
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
});
