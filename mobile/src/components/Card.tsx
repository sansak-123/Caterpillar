import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { color, radius, shadow, spacing } from "../theme/tokens";

export function Card({
  children,
  style,
  accentColor,
}: PropsWithChildren<{ style?: ViewStyle; accentColor?: string }>) {
  return (
    <View
      style={[
        styles.card,
        accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    gap: spacing.sm,
    ...shadow.card,
  },
});
