import { Pressable, StyleSheet, Text } from "react-native";

import { color, radius, spacing, touchTarget, type } from "../theme/tokens";

type Variant = "primary" | "secondary" | "danger";

const backgroundFor: Record<Variant, string> = {
  primary: color.accent,
  secondary: color.surfaceRaised,
  danger: color.danger,
};

const textColorFor: Record<Variant, string> = {
  primary: "#1B1400",
  secondary: color.textPrimary,
  danger: color.textPrimary,
};

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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        fullWidth ? styles.fullWidth : null,
        { backgroundColor: backgroundFor[variant], opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[type.bodyStrong, { color: textColorFor[variant] }]}>{label}</Text>
    </Pressable>
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
