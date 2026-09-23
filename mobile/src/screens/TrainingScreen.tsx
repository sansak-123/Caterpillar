import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { color, spacing, type } from "../theme/tokens";

type Scenario = {
  id: string;
  title: string;
  description: string;
  tag: string;
};

const scenarios: Scenario[] = [
  {
    id: "GhostOperator",
    title: "Ghost Operator",
    description: "Dig alongside a translucent replay of an expert's cycle. Scored on time, smoothness, fuel/cycle.",
    tag: "Recommended",
  },
  {
    id: "NearMissReplay",
    title: "Near-Miss Replay",
    description: "Relive your rear-blind-spot near-miss from this morning, safely, in the simulator.",
    tag: "New from today",
  },
  {
    id: "IdleDiscipline",
    title: "Idle Discipline",
    description: "Practice minimizing unproductive idle across a full loading cycle.",
    tag: "Assigned",
  },
  {
    id: "LoadingInRain",
    title: "Loading in Rain",
    description: "Reduced visibility and traction — condition-adaptive proximity zones active.",
    tag: "Assigned",
  },
];

export function TrainingScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.label}>TRAINING</Text>
        <Text style={[type.display, styles.title]}>Ghost Operator</Text>
        <Text style={[type.body, styles.muted]}>
          Unity simulator scenarios, downloadable for offline use.
        </Text>

        <Card accentColor={color.accent} style={styles.heroCard}>
          <View style={styles.heroPreview}>
            <Text style={styles.heroPreviewLabel}>Unity viewport</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={type.h2}>Your skill factor</Text>
            <Badge label="0.82 → 0.90 goal" tone="info" />
          </View>
          <Text style={[type.body, styles.muted]}>
            Closing the gap with the ghost improves your task-time estimates automatically.
          </Text>
          <PrimaryButton label="Launch Ghost Operator" onPress={() => {}} />
        </Card>

        <Text style={[type.h2, styles.sectionTitle]}>All scenarios</Text>
        <View style={styles.scenarioList}>
          {scenarios.map((s) => (
            <Card key={s.id}>
              <View style={styles.rowBetween}>
                <Text style={[type.bodyStrong, styles.title]}>{s.title}</Text>
                <Badge label={s.tag} tone={s.tag === "New from today" ? "danger" : "neutral"} />
              </View>
              <Text style={[type.body, styles.muted]}>{s.description}</Text>
              <PrimaryButton label="Run scenario" onPress={() => {}} variant="secondary" fullWidth={false} />
            </Card>
          ))}
        </View>

        <Text style={[type.h2, styles.sectionTitle]}>Other ways to learn</Text>
        <View style={styles.rowGap}>
          <Card style={styles.halfCard}>
            <Text style={type.bodyStrong}>Video library</Text>
            <Text style={[type.caption, styles.muted]}>12 lessons · 4 downloaded</Text>
          </Card>
          <Card style={styles.halfCard}>
            <Text style={type.bodyStrong}>Book instructor</Text>
            <Text style={[type.caption, styles.muted]}>Next slot: Fri 9:00 AM</Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  title: {
    color: color.textPrimary,
  },
  muted: {
    color: color.textMuted,
  },
  heroCard: {
    gap: spacing.sm,
  },
  heroPreview: {
    height: 160,
    borderRadius: 12,
    backgroundColor: "#0B0C0E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.border,
  },
  heroPreviewLabel: {
    color: color.textMuted,
    ...type.caption,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  scenarioList: {
    gap: spacing.sm,
  },
  rowGap: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  halfCard: {
    flex: 1,
  },
});
