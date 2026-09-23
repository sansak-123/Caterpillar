import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "../theme/useColors";

// A very subtle top-down glow instead of a flat single-color background — the
// low-cost trick that makes a UI read as "designed" rather than "default background".
export function ScreenBackground({ children }: PropsWithChildren) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={[colors.bgGlowTop, colors.bg, colors.bg]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
