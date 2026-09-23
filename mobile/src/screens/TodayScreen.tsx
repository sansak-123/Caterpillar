import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ConnectivityPill } from "../components/ConnectivityPill";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { color, spacing, type } from "../theme/tokens";

type TaskStatus = "pending" | "in_progress" | "done";

type Task = {
  id: string;
  title: string;
  p50Min: number;
  p90Min: number;
  weather: string;
  risk: "safe" | "caution" | "danger";
  status: TaskStatus;
};

// Mock day plan mirroring the seed/demo scenario — Phase 4 will replace this with the
// pre-scored plan pulled from /sync/pull and re-scored offline via lib/onnx.
const mockTasks: Task[] = [
  {
    id: "T001",
    title: "Earth Excavation — North Trench",
    p50Min: 58,
    p90Min: 71,
    weather: "Sunny",
    risk: "safe",
    status: "in_progress",
  },
  {
    id: "T002",
    title: "Trenching — Utility Line B",
    p50Min: 52,
    p90Min: 66,
    weather: "Rainy",
    risk: "caution",
    status: "pending",
  },
  {
    id: "T003",
    title: "Material Loading — Truck Bay 2",
    p50Min: 42,
    p90Min: 55,
    weather: "Cloudy",
    risk: "caution",
    status: "pending",
  },
  {
    id: "T005",
    title: "Demolition — Section D",
    p50Min: 105,
    p90Min: 128,
    weather: "Windy",
    risk: "danger",
    status: "pending",
  },
];

const riskLabel: Record<Task["risk"], string> = {
  safe: "Low risk",
  caution: "Weather risk",
  danger: "High risk",
};

function TaskBody({ task }: { task: Task }) {
  return (
    <>
      <View style={styles.taskHeader}>
        <Text style={[type.bodyStrong, styles.taskTitle]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.status === "in_progress" ? <Badge label="In progress" tone="info" /> : null}
      </View>

      <View style={styles.taskMetaRow}>
        <Badge label={task.weather} tone="neutral" />
        <Badge label={riskLabel[task.risk]} tone={task.risk} />
      </View>

      <View style={styles.estimateRow}>
        <Text style={type.caption}>
          <Text style={styles.muted}>Est. </Text>
          <Text style={styles.estimateValue}>{task.p50Min}</Text>
          <Text style={styles.muted}>–{task.p90Min} min (P50–P90)</Text>
        </Text>
      </View>

      <View style={styles.actionsRow}>
        {task.status === "in_progress" ? (
          <>
            <PrimaryButton label="Complete" onPress={() => {}} variant="primary" fullWidth={false} />
            <PrimaryButton label="Pause" onPress={() => {}} variant="secondary" fullWidth={false} />
          </>
        ) : (
          <PrimaryButton label="Start task" onPress={() => {}} variant="secondary" fullWidth={false} />
        )}
      </View>
    </>
  );
}

export function TodayScreen() {
  const inProgress = mockTasks.find((t) => t.status === "in_progress");
  const upcoming = mockTasks.filter((t) => t.status !== "in_progress");
  const totalMin = mockTasks.reduce((sum, t) => sum + t.p50Min, 0);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View>
              <Text style={type.label}>WED, 1 MAY</Text>
              <Text style={[type.display, styles.title]}>Today&apos;s tasks</Text>
            </View>
            <ConnectivityPill />
          </View>

          <View style={styles.statRow}>
            <Text style={[type.caption, styles.muted]}>OP1001 · EXC001</Text>
            <View style={styles.statDivider} />
            <Text style={[type.caption, styles.muted]}>{mockTasks.length} tasks</Text>
            <View style={styles.statDivider} />
            <Text style={[type.caption, styles.muted]}>~{Math.round(totalMin / 60)}h {totalMin % 60}m total</Text>
          </View>

          {inProgress ? (
            <GlassCard glowColor={color.infoGlow} style={styles.heroTask}>
              <Text style={[type.label, { color: color.info }]}>IN PROGRESS</Text>
              <TaskBody task={inProgress} />
            </GlassCard>
          ) : null}

          <Text style={[type.h2, styles.sectionTitle]}>Up next</Text>
          <View style={styles.taskList}>
            {upcoming.map((task) => (
              <Card key={task.id} accentColor={color[task.risk]} style={styles.taskCard}>
                <TaskBody task={task} />
              </Card>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
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
    alignItems: "flex-start",
  },
  title: {
    color: color.textPrimary,
  },
  muted: {
    color: color.textMuted,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: color.textMuted,
  },
  heroTask: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  taskList: {
    gap: spacing.sm,
  },
  taskCard: {
    gap: spacing.sm,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  taskTitle: {
    color: color.textPrimary,
    flex: 1,
  },
  taskMetaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  estimateRow: {
    marginTop: spacing.xs,
  },
  estimateValue: {
    color: color.textPrimary,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
