import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { radius, spacing, type } from "../theme/tokens";

function ArrowRightIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function InsightCard({
  eyebrow,
  headline,
  actionLabel,
  onPress,
}: {
  eyebrow: string;
  headline: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <LinearGradient
      colors={["#FFD866", "#FFC72C", "#F0A500"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.eyebrowPill}>
        <Text style={[type.label, styles.eyebrowText]}>{eyebrow}</Text>
      </View>
      <Text style={[type.h1, styles.headline]}>{headline}</Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={styles.actionRow}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
        <ArrowRightIcon color="#1A1A1A" />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(26,26,26,0.14)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  eyebrowText: {
    color: "#1A1A1A",
  },
  headline: {
    color: "#1A1A1A",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionText: {
    ...type.bodyStrong,
    color: "#1A1A1A",
  },
});
