import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { useThemeStore } from "../store/theme";
import { useColors } from "../theme/useColors";
import { radius } from "../theme/tokens";

function SunIcon({ color: c }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5} stroke={c} strokeWidth={2} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <Line
          key={deg}
          x1={12}
          y1={2.5}
          x2={12}
          y2={5}
          stroke={c}
          strokeWidth={2}
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </Svg>
  );
}

function MoonIcon({ color: c }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function ThemeToggle() {
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
      onPress={() => {
        Haptics.selectionAsync();
        toggle();
      }}
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {mode === "light" ? <MoonIcon color={colors.textPrimary} /> : <SunIcon color={colors.textPrimary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
