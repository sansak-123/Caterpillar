import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AssistantIcon } from "../components/icons";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { color, radius, spacing, touchTarget, type } from "../theme/tokens";

type QuickAction = { id: string; label: string };

const quickActions: QuickAction[] = [
  { id: "log_incident", label: "Log incident" },
  { id: "explain_estimate", label: "Explain estimate" },
  { id: "safety_help", label: "Safety help" },
  { id: "book_instructor", label: "Book instructor" },
];

export function AssistantScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={type.label}>ASSISTANT</Text>
          <Badge label="Offline assistant" tone="caution" />
        </View>
        <Text style={[type.display, styles.title]}>How can I help?</Text>
        <Text style={[type.body, styles.muted]}>
          Offline mode answers from cached safety cards and SOPs. Online mode uses Claude for
          free-form questions and incident structuring.
        </Text>

        <View style={styles.quickGrid}>
          {quickActions.map((a) => (
            <PressableAction key={a.id} label={a.label} />
          ))}
        </View>

        <Card>
          <View style={styles.messageRow}>
            <View style={styles.avatar}>
              <AssistantIcon color={color.bg} size={18} />
            </View>
            <View style={styles.bubble}>
              <Text style={[type.body, styles.title]}>
                Your 10:00 estimate was widened by +9 min for rain and +6 min because this is a
                beginner-skill task. Want the full breakdown?
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.inputBar}>
          <Text style={[type.body, styles.inputPlaceholder]}>Type or hold to talk…</Text>
          <View style={styles.micButton}>
            <Text style={styles.micGlyph}>●</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PressableAction({ label }: { label: string }) {
  return (
    <View style={styles.actionTile}>
      <Text style={[type.bodyStrong, styles.title]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: color.textPrimary,
  },
  muted: {
    color: color.textMuted,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionTile: {
    minWidth: "47%",
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
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
    backgroundColor: color.accent,
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
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.md,
    justifyContent: "space-between",
  },
  inputPlaceholder: {
    color: color.textMuted,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  micGlyph: {
    color: "#1B1400",
    fontSize: 12,
  },
});
