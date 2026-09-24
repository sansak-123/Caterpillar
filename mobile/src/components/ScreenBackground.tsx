import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "../theme/useColors";

// Plain warm-paper page background — the redesign is deliberately flat.
export function ScreenBackground({ children }: PropsWithChildren) {
  const colors = useColors();
  return <View style={[styles.container, { backgroundColor: colors.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
