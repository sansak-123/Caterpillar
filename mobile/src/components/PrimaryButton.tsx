import type { ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useIsWide } from "../theme/useLayout";
import { useColors } from "../theme/useColors";
import { radius, spacing, touchTarget } from "../theme/tokens";

type Variant = "primary" | "accent" | "secondary" | "danger";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// primary   → CAT yellow, the main action on a surface ("Confirm", "Start safety check")
// secondary → white with a hairline border ("Dismiss", "Continue")
// accent    → soft sand fill for the alternate channel ("Confirm by voice")
// danger    → solid red
export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  fullWidth = true,
  testID,
  icon,
  iconRight = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  fullWidth?: boolean;
  testID?: string;
  icon?: ReactNode;
  /** Render the icon after the label (e.g. a trailing arrow on a CTA). */
  iconRight?: boolean;
}) {
  const colors = useColors();
  const isWide = useIsWide();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const backgroundFor: Record<Variant, string> = {
    primary: colors.accent,
    accent: colors.surfaceRaised,
    secondary: colors.surface,
    danger: colors.danger,
  };
  const borderFor: Record<Variant, string> = {
    primary: colors.accentPressed,
    accent: colors.border,
    secondary: colors.borderStrong,
    danger: colors.danger,
  };
  const textColorFor: Record<Variant, string> = {
    primary: colors.accentOn,
    accent: colors.textPrimary,
    secondary: colors.textPrimary,
    danger: "#FFFFFF",
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      testID={testID}
      onPressIn={() => {
        // Reanimated shared values are intentionally mutable refs (the documented
        // API) — the React Compiler lint rule doesn't know that exception yet.
        // eslint-disable-next-line
        scale.value = withSpring(0.97, { damping: 16, stiffness: 300 });
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
        // Gloved-finger target on the in-cab phone layout; a desktop-sized control on
        // the wide (pointer) layout.
        { minHeight: isWide ? 42 : touchTarget },
        fullWidth ? styles.fullWidth : null,
        { backgroundColor: backgroundFor[variant], borderColor: borderFor[variant] },
        animatedStyle,
      ]}
    >
      <View style={styles.inner}>
        {iconRight ? null : icon}
        <Text style={[styles.label, { color: textColorFor[variant] }]}>{label}</Text>
        {iconRight ? icon : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md + 2,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
