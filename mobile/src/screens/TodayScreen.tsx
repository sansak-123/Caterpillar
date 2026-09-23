import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ConnectivityPill } from "../components/ConnectivityPill";
import { GlassCard } from "../components/GlassCard";
import { FlaskIcon, HazardIcon, SpeakerIcon } from "../components/icons";
import { InsightCard } from "../components/InsightCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressRing } from "../components/ProgressRing";
import { ScreenBackground } from "../components/ScreenBackground";
import { ThemeToggle } from "../components/ThemeToggle";
import { PRE_START_CHECKLIST } from "../content/preStartChecklist";
import { fetchTasksToday, type ApiTask } from "../lib/api/client";
import { estimateTaskTimeOffline } from "../lib/onnx/taskTimeModel";
import { appendToOutbox } from "../lib/sync/outbox";
import { useAuthStore } from "../store/auth";
import { useChecklistStore } from "../store/checklist";
import { useConnectivityStore } from "../store/connectivity";
import { useColors } from "../theme/useColors";
import { radius, shadow, spacing, touchTarget, type } from "../theme/tokens";

type TaskStatus = "pending" | "in_progress" | "done";

type Task = {
  id: string;
  title: string;
  depth: string;
  p50Min: number;
  p90Min: number;
  estMin: number;
  weather: string;
  risk: "safe" | "caution" | "danger";
  status: TaskStatus;
  hazards: string[];
  version: number;
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
    estMin: 60, // tasks_seed.csv T001
    weather: "Sunny",
    risk: "safe",
    status: "in_progress",
    hazards: ["Buried fiber line, west edge"],
    version: 1,
  },
  {
    id: "T002",
    title: "Trenching — Utility Line B",
    depth: "1.2 m",
    p50Min: 52,
    p90Min: 66,
    estMin: 45, // tasks_seed.csv T002
    weather: "Rainy",
    risk: "caution",
    status: "pending",
    hazards: ["Soft ground after rain", "Workers on south side"],
    version: 1,
  },
  {
    id: "T003",
    title: "Material Loading — Truck Bay 2",
    depth: "—",
    p50Min: 42,
    p90Min: 55,
    estMin: 30, // tasks_seed.csv T003
    weather: "Cloudy",
    risk: "caution",
    status: "pending",
    hazards: ["Truck reversing zone"],
    version: 1,
  },
  {
    id: "T005",
    title: "Demolition — Section D",
    depth: "—",
    p50Min: 105,
    p90Min: 128,
    estMin: 90, // tasks_seed.csv T005
    weather: "Windy",
    risk: "danger",
    status: "pending",
    hazards: ["Overhead power line", "High wind — debris risk"],
    version: 1,
  },
];

const riskLabel: Record<Task["risk"], string> = {
  safe: "Low risk",
  caution: "Weather risk",
  danger: "High risk",
};

function mapApiTask(t: ApiTask): Task {
  const risk: Task["risk"] = t.risk_band === "danger" ? "danger" : t.risk_band === "caution" ? "caution" : "safe";
  const status: TaskStatus = t.status === "in_progress" || t.status === "done" ? t.status : "pending";
  return {
    id: t.task_id,
    title: `${t.task_type} — ${t.machine_id}`,
    depth: "—",
    p50Min: t.p50_min ?? t.est_min,
    p90Min: t.p90_min ?? t.est_min,
    estMin: t.est_min,
    weather: t.weather_condition ?? "Unknown",
    risk,
    status,
    hazards: [],
    version: t.version,
  };
}

function speakTask(task: Task) {
  const hazardText = task.hazards.length ? ` Known hazards: ${task.hazards.join(". ")}.` : "";
  const depthText = task.depth !== "—" ? ` Dig depth ${task.depth}.` : "";
  Speech.speak(
    `${task.title}.${depthText} Estimated ${task.p50Min} to ${task.p90Min} minutes.${hazardText}`,
    { rate: 0.95 }
  );
}

function TaskBody({
  task,
  colors,
  onStart,
  onPause,
  onComplete,
  offlineEstimate,
}: {
  task: Task;
  colors: ReturnType<typeof useColors>;
  onStart: () => void;
  onPause: () => void;
  onComplete: () => void;
  offlineEstimate?: { p50: number; p90: number } | null;
}) {
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

      {offlineEstimate ? (
        // CLAUDE.md §3.1: offline re-scoring uses the on-device ONNX model and must be
        // marked "approximate (offline)" — never presented as equivalent to the
        // server's fully-informed, SHAP-explained estimate from morning sync.
        <Text style={[type.caption, { fontStyle: "italic" }]}>
          <Text style={{ color: colors.textMuted }}>~Re-scored offline: </Text>
          <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>{offlineEstimate.p50}</Text>
          <Text style={{ color: colors.textMuted }}>–{offlineEstimate.p90} min (approximate)</Text>
        </Text>
      ) : null}

      <View style={styles.actionsRow}>
        {task.status === "in_progress" ? (
          <>
            <PrimaryButton label="Complete" onPress={onComplete} variant="primary" fullWidth={false} />
            <PrimaryButton label="Pause" onPress={onPause} variant="secondary" fullWidth={false} />
          </>
        ) : (
          <PrimaryButton label="Start task" onPress={onStart} variant="secondary" fullWidth={false} />
        )}
      </View>
    </>
  );
}

export function TodayScreen() {
  const colors = useColors();
  const checkedCount = useChecklistStore((s) => s.checkedIds.size);
  const devNetworkCut = useConnectivityStore((s) => s.devNetworkCut);
  const token = useAuthStore((s) => s.token);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [isLive, setIsLive] = useState(false);
  const [offlineEstimates, setOfflineEstimates] = useState<Record<string, { p50: number; p90: number }>>({});

  // Session bootstrap and connectivity status/queued-count are owned by the root
  // layout's useSyncEngine() now (CLAUDE.md §3.1) — this effect only reacts to a token
  // becoming available to fetch this operator's real tasks, falling back to demo data
  // otherwise rather than showing an empty/broken screen.
  useEffect(() => {
    if (devNetworkCut || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const apiTasks = await fetchTasksToday(token);
        if (cancelled) return;
        setTasks(apiTasks.map(mapApiTask));
        setIsLive(true);
      } catch {
        // Backend reachable enough for a token but not for this call — keep whatever
        // was already showing (demo data or the last successful live fetch).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, devNetworkCut]);

  // CLAUDE.md §3.1: "offline re-scoring uses ONNX and marks explanation 'approximate
  // (offline)'." The dev "cut network" toggle is the demoable stand-in for genuinely
  // losing connectivity (USP-5: safety/estimates never wait on the network) — when it's
  // on, re-score every non-done task on-device from whatever model bundle was already
  // downloaded, entirely locally, no network call involved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!devNetworkCut) {
        if (!cancelled) setOfflineEstimates({});
        return;
      }
      const now = new Date();
      const entries = await Promise.all(
        tasks
          .filter((t) => t.status !== "done")
          .map(async (t) => {
            const result = await estimateTaskTimeOffline(t.estMin, {
              task_type: t.title.split(" — ")[0],
              weather: t.weather,
              hour_of_day: now.getHours(),
              day_of_week: now.getDay(),
            });
            return result ? ([t.id, { p50: result.value, p90: result.range[1] }] as const) : null;
          })
      );
      if (!cancelled) {
        setOfflineEstimates(Object.fromEntries(entries.filter((e): e is readonly [string, { p50: number; p90: number }] => e !== null)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devNetworkCut, tasks]);

  // Optimistic local update + a real outbox write (CLAUDE.md §3.1 outbox pattern) —
  // this succeeds instantly offline; useSyncEngine drains it to /sync/push whenever
  // there's a connection, and the server's conflict rule (§3.1) reconciles `version`.
  async function changeTaskStatus(task: Task, status: TaskStatus) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status, version: t.version + 1 } : t)));
    try {
      await appendToOutbox("task_status_update", {
        task_id: task.id,
        status,
        base_version: task.version,
      });
    } catch {
      // lib/db not available on this platform/build — the optimistic UI update above
      // still stands; there's just nothing queued to sync yet.
    }
  }

  const inProgress = tasks.find((t) => t.status === "in_progress");
  const upcoming = tasks.filter((t) => t.status !== "in_progress");
  const doneCount = tasks.filter((t) => t.status === "done").length;

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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Demo panel"
                onPress={() => router.push("/demo")}
                style={[styles.iconButton, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              >
                <FlaskIcon color={colors.textSecondary} size={18} />
              </Pressable>
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
                progress={tasks.length ? doneCount / tasks.length : 0}
                size={92}
                strokeWidth={9}
                color={colors.accent}
                trackColor={colors.ringTrack}
                value={`${doneCount}/${tasks.length}`}
                valueColor={colors.textPrimary}
              />
              <View style={styles.progressText}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>OP1001 · EXC001</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {tasks.length} tasks scheduled today · {isLive ? "live from backend" : "demo data"} — reorder anytime
                </Text>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(110).duration(400)}>
            <View style={styles.shiftToolsRow}>
              <ShiftToolButton
                label="Pre-start checklist"
                sublabel={`${checkedCount}/${PRE_START_CHECKLIST.length} done`}
                onPress={() => router.push("/checklist")}
                colors={colors}
              />
              <ShiftToolButton
                label="End-of-shift log"
                sublabel="Auto-filled"
                onPress={() => router.push("/shift-log")}
                colors={colors}
              />
            </View>
          </Animated.View>

          {inProgress ? (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <GlassCard glowColor={colors.infoGlow} style={styles.heroTask}>
                <Text style={[type.label, { color: colors.info }]}>IN PROGRESS</Text>
                <TaskBody
                  task={inProgress}
                  colors={colors}
                  onStart={() => changeTaskStatus(inProgress, "in_progress")}
                  onPause={() => changeTaskStatus(inProgress, "pending")}
                  onComplete={() => changeTaskStatus(inProgress, "done")}
                  offlineEstimate={offlineEstimates[inProgress.id]}
                />
              </GlassCard>
            </Animated.View>
          ) : null}

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Up next</Text>
          <View style={styles.taskList}>
            {upcoming.map((task, i) => (
              <Animated.View key={task.id} entering={FadeInDown.delay(200 + i * 70).duration(400)}>
                <Card accentColor={colors[task.risk]}>
                  <TaskBody
                    task={task}
                    colors={colors}
                    onStart={() => changeTaskStatus(task, "in_progress")}
                    onPause={() => changeTaskStatus(task, "pending")}
                    onComplete={() => changeTaskStatus(task, "done")}
                    offlineEstimate={offlineEstimates[task.id]}
                  />
                </Card>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function ShiftToolButton({
  label,
  sublabel,
  onPress,
  colors,
}: {
  label: string;
  sublabel: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.shiftToolButton,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow.card(colors.mode),
      ]}
    >
      <Text style={[type.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>{sublabel}</Text>
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
    alignItems: "flex-start",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  shiftToolsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  shiftToolButton: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    justifyContent: "center",
    gap: 2,
  },
});
