import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";
import { ArrowRightIcon } from "./icons";

// Dark featured banner (the reference "Featured exercise" hero): near-black panel,
// yellow headline, outlined eyebrow chip, yellow call-to-action, faint ring motif.
export function InsightCard({
  eyebrow,
  headline,
  body,
  actionLabel,
  onPress,
  testID,
}: {
  eyebrow: string;
  headline: string;
  body?: string;
  actionLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.hero }]}>
      <View style={styles.rings} pointerEvents="none">
        <Svg width={220} height={220}>
          <Circle cx={150} cy={150} r={95} stroke={colors.heroText} strokeOpacity={0.12} strokeWidth={22} fill="none" />
          <Circle cx={150} cy={150} r={45} stroke={colors.heroText} strokeOpacity={0.08} strokeWidth={14} fill="none" />
        </Svg>
      </View>
      <View style={[styles.eyebrowPill, { borderColor: `${colors.heroText}66`, backgroundColor: `${colors.heroText}1F` }]}>
        <Text style={[type.label, { color: colors.heroText, fontSize: 10 }]}>{eyebrow.toUpperCase()}</Text>
      </View>
      <Text style={[type.h1, { color: colors.heroText }]}>{headline}</Text>
      {body ? <Text style={[type.caption, styles.body, { color: `${colors.heroText}CC` }]}>{body}</Text> : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={[styles.action, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.actionText, { color: colors.accentOn }]}>{actionLabel}</Text>
        <ArrowRightIcon color={colors.accentOn} size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm + 2,
    overflow: "hidden",
  },
  rings: {
    position: "absolute",
    right: -40,
    bottom: -60,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.sm - 2,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  body: {
    maxWidth: 520,
    lineHeight: 20,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  actionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
