import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { AssistantIcon } from "../components/icons";
import { Badge } from "../components/Badge";
import { GlassCard } from "../components/GlassCard";
import { ScreenBackground } from "../components/ScreenBackground";
import { useColors } from "../theme/useColors";
import { radius, shadow, spacing, touchTarget, type } from "../theme/tokens";

type QuickAction = { id: string; label: string };

const quickActions: QuickAction[] = [
  { id: "log_incident", label: "Log incident" },
  { id: "explain_estimate", label: "Explain estimate" },
  { id: "safety_help", label: "Safety help" },
  { id: "book_instructor", label: "Book instructor" },
];

export function AssistantScreen() {
  const colors = useColors();

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={[type.label, { color: colors.textMuted }]}>ASSISTANT</Text>
            <Badge label="Offline assistant" tone="caution" />
          </View>
          <Text style={[type.display, { color: colors.textPrimary }]}>How can I help?</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Offline mode answers from cached safety cards and SOPs. Online mode uses Claude for
            free-form questions and incident structuring.
          </Text>

          <View style={styles.quickGrid}>
            {quickActions.map((a, i) => (
              <Animated.View key={a.id} entering={FadeInDown.delay(i * 60).duration(350)} style={styles.tileWrap}>
                <PressableAction label={a.label} colors={colors} />
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <GlassCard glowColor={colors.infoGlow}>
              <View style={styles.messageRow}>
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <AssistantIcon color={colors.accentOn} size={18} />
                </View>
                <View style={styles.bubble}>
                  <Text style={[type.body, { color: colors.textPrimary }]}>
                    Your 10:00 estimate was widened by +9 min for rain and +6 min because this is a
                    beginner-skill task. Want the full breakdown?
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          <View style={[styles.inputBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, shadow.card(colors.mode)]}>
            <Text style={[type.body, { color: colors.textMuted }]}>Type or hold to talk…</Text>
            <View style={[styles.micButton, { backgroundColor: colors.accent }, shadow.glow(colors.accentGlow)]}>
              <Text style={[styles.micGlyph, { color: colors.accentOn }]}>●</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function PressableAction({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      style={({ pressed }) => [
        styles.actionTile,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        shadow.card(colors.mode),
        pressed ? { opacity: 0.75 } : null,
      ]}
    >
      <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 72,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tileWrap: {
    minWidth: "47%",
    flexGrow: 1,
  },
  actionTile: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    flex: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: "space-between",
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  micGlyph: {
    fontSize: 12,
  },
});
