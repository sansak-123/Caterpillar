import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useColors } from "../theme/useColors";
import { radius, shadow, spacing } from "../theme/tokens";

// The "featured" surface tier (hero task, live alert, assistant replies). In the flat
// redesign it's a bordered panel whose border picks up the glow color, so the thing
// that matters most right now is outlined in its status color instead of blurred.
export function GlassCard({
  children,
  style,
  glowColor,
}: PropsWithChildren<{ style?: ViewStyle; glowColor?: string }>) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.glassFill, borderColor: glowColor ?? colors.glassBorder },
        shadow.card(colors.mode),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md + 2,
    gap: spacing.sm + 2,
  },
});
