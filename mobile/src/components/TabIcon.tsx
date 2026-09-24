import { StyleSheet, View } from "react-native";

import { useColors } from "../theme/useColors";
import { radius, spacing } from "../theme/tokens";

// Active tab gets the same pale-yellow highlight the sidebar uses for its active item.
export function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  if (!focused) return <View style={styles.wrap}>{children}</View>;
  return <View style={[styles.wrap, styles.pill, { backgroundColor: colors.navActive }]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    width: 48,
    height: 30,
    borderRadius: radius.md,
    marginBottom: -spacing.xs,
  },
});
