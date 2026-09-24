import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useColors } from "../theme/useColors";
import { radius, shadow, spacing } from "../theme/tokens";

// Flat panel: off-white fill, hairline border, barely-there shadow. `accentColor`
// keeps its old meaning (a status stripe on the leading edge) so risk/severity still
// reads at a glance.
export function Card({
  children,
  style,
  accentColor,
}: PropsWithChildren<{ style?: ViewStyle; accentColor?: string }>) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow.card(colors.mode),
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
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    gap: spacing.sm + 2,
  },
});
