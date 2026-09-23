import { StyleSheet, View } from "react-native";

import { useColors } from "../theme/useColors";
import { radius, spacing } from "../theme/tokens";

// Active tab gets a solid rounded-pill fill behind the icon (matching the reference
// design's active-tab treatment) instead of just a color change.
export function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  if (!focused) return <View style={styles.wrap}>{children}</View>;
  return (
    <View style={[styles.wrap, styles.pill, { backgroundColor: colors.primaryDark }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    width: 44,
    height: 32,
    borderRadius: radius.pill,
    marginBottom: -spacing.xs,
  },
});
