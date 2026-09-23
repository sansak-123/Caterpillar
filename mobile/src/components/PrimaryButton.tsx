import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useColors } from "../theme/useColors";
import { radius, shadow, spacing, touchTarget, type } from "../theme/tokens";

type Variant = "primary" | "accent" | "secondary" | "danger";

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
  const colors = useColors();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const backgroundFor: Record<Variant, string> = {
    primary: colors.primaryDark,
    accent: colors.accent,
    secondary: colors.surfaceRaised,
    danger: colors.danger,
  };
  const textColorFor: Record<Variant, string> = {
    primary: colors.primaryDarkOn,
    accent: colors.accentOn,
    secondary: colors.textPrimary,
    danger: "#FFFFFF",
  };
  const glowFor: Partial<Record<Variant, string>> = {
    accent: colors.accentGlow,
  };

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
        glowFor[variant] ? shadow.glow(glowFor[variant]!) : shadow.card(colors.mode),
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
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
});
