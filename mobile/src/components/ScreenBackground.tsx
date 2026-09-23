import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { color } from "../theme/tokens";

// A very subtle top-down glow instead of a flat single-color background — the
// low-cost trick that makes a dark UI read as "premium" rather than "just black".
export function ScreenBackground({ children }: PropsWithChildren) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[color.bgGlowTop, color.bg, color.bg]}
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
    backgroundColor: color.bg,
  },
});
