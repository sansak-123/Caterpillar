import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Pressable } from "react-native";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ConnectivityPill } from "../components/ConnectivityPill";
import { GlassCard } from "../components/GlassCard";
import { HazardIcon, SpeakerIcon } from "../components/icons";
import { InsightCard } from "../components/InsightCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressRing } from "../components/ProgressRing";
import { ScreenBackground } from "../components/ScreenBackground";
import { ThemeToggle } from "../components/ThemeToggle";
import { useColors } from "../theme/useColors";
import { spacing, type } from "../theme/tokens";

type TaskStatus = "pending" | "in_progress" | "done";

type Task = {
  id: string;
  title: string;
  depth: string;
  p50Min: number;
  p90Min: number;
  weather: string;
  risk: "safe" | "caution" | "danger";
  status: TaskStatus;
  hazards: string[];
};

// Mock day plan mirroring the seed/demo scenario — Phase 4 will replace this with the
// pre-scored plan pulled from /sync/pull and re-scored offline via lib/onnx. Hazards +
// dig depth are here because a task card is the instruction sheet, not just a
// schedule entry (CLAUDE.md section 2.1 Rule 6).
const mockTasks: Task[] = [
  {
    id: "T001",
    title: "Earth Excavation — North Trench",
    depth: "1.8 m",
    p50Min: 58,
    p90Min: 71,
    weather: "Sunny",
    risk: "safe",
    status: "in_progress",
    hazards: ["Buried fiber line, west edge"],
  },
  {
    id: "T002",
    title: "Trenching — Utility Line B",
    depth: "1.2 m",
    p50Min: 52,
    p90Min: 66,
    weather: "Rainy",
    risk: "caution",
    status: "pending",
    hazards: ["Soft ground after rain", "Workers on south side"],
  },
  {
    id: "T003",
    title: "Material Loading — Truck Bay 2",
    depth: "—",
    p50Min: 42,
    p90Min: 55,
    weather: "Cloudy",
    risk: "caution",
    status: "pending",
    hazards: ["Truck reversing zone"],
  },
  {
    id: "T005",
    title: "Demolition — Section D",
    depth: "—",
    p50Min: 105,
    p90Min: 128,
    weather: "Windy",
    risk: "danger",
    status: "pending",
    hazards: ["Overhead power line", "High wind — debris risk"],
  },
];

const riskLabel: Record<Task["risk"], string> = {
  safe: "Low risk",
  caution: "Weather risk",
  danger: "High risk",
};

function speakTask(task: Task) {
  const hazardText = task.hazards.length ? ` Known hazards: ${task.hazards.join(". ")}.` : "";
  const depthText = task.depth !== "—" ? ` Dig depth ${task.depth}.` : "";
  Speech.speak(
    `${task.title}.${depthText} Estimated ${task.p50Min} to ${task.p90Min} minutes.${hazardText}`,
    { rate: 0.95 }
  );
}

function TaskBody({ task, colors }: { task: Task; colors: ReturnType<typeof useColors> }) {
  return (
    <>
      <View style={styles.taskHeader}>
        <Text style={[type.bodyStrong, { color: colors.textPrimary, flex: 1 }]} numberOfLines={2}>
          {task.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Read task aloud"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            speakTask(task);
          }}
          style={styles.speakerButton}
        >
          <SpeakerIcon color={colors.textSecondary} size={20} />
        </Pressable>
        {task.status === "in_progress" ? <Badge label="In progress" tone="info" /> : null}
      </View>

      <View style={styles.taskMetaRow}>
        <Badge label={task.weather} tone="neutral" />
        <Badge label={riskLabel[task.risk]} tone={task.risk} />
        {task.depth !== "—" ? <Badge label={`Depth ${task.depth}`} tone="neutral" /> : null}
      </View>

      {task.hazards.length ? (
        <View style={styles.hazardBox}>
          <HazardIcon color={colors.caution} size={16} />
          <Text style={[type.caption, { color: colors.textSecondary, flex: 1 }]}>
            {task.hazards.join(" · ")}
          </Text>
        </View>
      ) : null}

      <Text style={type.caption}>
        <Text style={{ color: colors.textMuted }}>Est. </Text>
        <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{task.p50Min}</Text>
        <Text style={{ color: colors.textMuted }}>–{task.p90Min} min (P50–P90)</Text>
      </Text>

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
  const colors = useColors();
  const inProgress = mockTasks.find((t) => t.status === "in_progress");
  const upcoming = mockTasks.filter((t) => t.status !== "in_progress");
  const doneCount = mockTasks.filter((t) => t.status === "done").length;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[type.label, { color: colors.textMuted }]}>WED, 1 MAY</Text>
              <Text style={[type.display, { color: colors.textPrimary }]}>Today&apos;s tasks</Text>
            </View>
            <View style={styles.headerActions}>
              <ThemeToggle />
              <ConnectivityPill />
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(400)}>
            <InsightCard
              eyebrow="Assistant insight"
              headline="Rain moves in at 2pm — the Trenching task will likely overrun by ~15 min."
              actionLabel="Ask about today's plan"
              onPress={() => {}}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Card style={styles.progressCard}>
              <ProgressRing
                progress={doneCount / mockTasks.length}
                size={92}
                strokeWidth={9}
                color={colors.accent}
                trackColor={colors.ringTrack}
                value={`${doneCount}/${mockTasks.length}`}
                valueColor={colors.textPrimary}
              />
              <View style={styles.progressText}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>OP1001 · EXC001</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {mockTasks.length} tasks scheduled today — reorder anytime
                </Text>
              </View>
            </Card>
          </Animated.View>

          {inProgress ? (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <GlassCard glowColor={colors.infoGlow} style={styles.heroTask}>
                <Text style={[type.label, { color: colors.info }]}>IN PROGRESS</Text>
                <TaskBody task={inProgress} colors={colors} />
              </GlassCard>
            </Animated.View>
          ) : null}

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Up next</Text>
          <View style={styles.taskList}>
            {upcoming.map((task, i) => (
              <Animated.View key={task.id} entering={FadeInDown.delay(200 + i * 70).duration(400)}>
                <Card accentColor={colors[task.risk]}>
                  <TaskBody task={task} colors={colors} />
                </Card>
              </Animated.View>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressText: {
    flex: 1,
    gap: 2,
  },
  heroTask: {
    marginTop: spacing.xs,
  },
  taskList: {
    gap: spacing.sm,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  speakerButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  hazardBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
