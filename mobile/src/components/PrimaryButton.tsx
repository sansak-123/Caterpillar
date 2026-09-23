import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { color, radius, shadow, spacing, touchTarget, type } from "../theme/tokens";

type Variant = "primary" | "secondary" | "danger";

const backgroundFor: Record<Variant, string> = {
  primary: color.accent,
  secondary: color.surfaceRaised,
  danger: color.danger,
};

const textColorFor: Record<Variant, string> = {
  primary: "#1B1400",
  secondary: color.textPrimary,
  danger: "#2A0B0C",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  fullWidth?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={() => {
        // Reanimated shared values are intentionally mutable refs (the documented
        // API) — the React Compiler lint rule doesn't know that exception yet.
        // eslint-disable-next-line
        scale.value = withSpring(0.96, { damping: 16, stiffness: 300 });
      }}
      onPressOut={() => {
        // eslint-disable-next-line
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      onPress={() => {
        Haptics.impactAsync(
          variant === "danger" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        );
        onPress();
      }}
      style={[
        styles.button,
        fullWidth ? styles.fullWidth : null,
        { backgroundColor: backgroundFor[variant] },
        variant === "primary" ? shadow.glow(color.accentGlow) : null,
        animatedStyle,
      ]}
    >
      <Text style={[type.bodyStrong, { color: textColorFor[variant] }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
});
