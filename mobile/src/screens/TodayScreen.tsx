import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from "react-native-svg";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

import { DEMO_MACHINE_MODEL, DEMO_OPERATOR_NAME } from "../components/AppShell";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { GlassCard } from "../components/GlassCard";
import { ArrowRightIcon, CheckIcon, ClipboardIcon, HazardIcon, PinIcon, SpeakerIcon, ShieldIcon } from "../components/icons";
import { CardHeader, Columns, Divider, Grid, Page, SectionTitle } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressRing } from "../components/ProgressRing";
import { PRE_START_CHECKLIST } from "../content/preStartChecklist";
import { DEMO_MACHINE_ID, fetchTasksToday, type ApiTask } from "../lib/api/client";
import { localeFor } from "../lib/assistant/voice";
import { estimateTaskTimeOffline } from "../lib/onnx/taskTimeModel";
import { appendToOutbox } from "../lib/sync/outbox";
import { useAuthStore } from "../store/auth";
import { useChecklistStore } from "../store/checklist";
import { useConnectivityStore } from "../store/connectivity";
import { useLanguageStore } from "../store/language";
import { useIsWide } from "../theme/useLayout";
import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";

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

// CLAUDE.md §2.1 Rule 6: "a voice read-out in the operator's own language (en/hi/ta)" —
// both the words spoken AND the TTS voice/accent (`localeFor`) switch with `language`.
function speakTask(task: Task, t: TFunction, language: Parameters<typeof localeFor>[0]) {
  const hazardText = task.hazards.length
    ? t("voice.knownHazards", { hazards: task.hazards.join(". ") })
    : "";
  const depthText = task.depth !== "—" ? t("voice.digDepth", { depth: task.depth }) : "";
  const text = t("voice.taskReadout", {
    title: task.title,
    depthText,
    p50: task.p50Min,
    p90: task.p90Min,
    hazardText,
  });
  Speech.speak(text, { rate: 0.95, language: localeFor(language) });
}

function TaskBody({
  task,
  colors,
  t,
  onStart,
  onPause,
  onComplete,
  onSpeak,
  offlineEstimate,
}: {
  task: Task;
  colors: ReturnType<typeof useColors>;
  t: TFunction;
  onStart: () => void;
  onPause: () => void;
  onComplete: () => void;
  onSpeak: () => void;
  offlineEstimate?: { p50: number; p90: number } | null;
}) {
  const riskLabel: Record<Task["risk"], string> = {
    safe: t("risk.safe"),
    caution: t("risk.caution"),
    danger: t("risk.danger"),
  };
  const colorsForRisk = { safe: colors.safe, caution: colors.caution, danger: colors.danger };
  return (
    // Card/GlassCard apply `gap` to their own direct children — this wrapper (needed so
    // Maestro/testID can address one task's contents specifically, since two upcoming
    // tasks otherwise render identical text/labels) reproduces that same gap itself so
    // the internal spacing doesn't collapse now that Card only sees one child.
    <View testID={`task-card-${task.id}`} style={{ gap: spacing.sm + 2 }}>
      <View style={styles.taskHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>{task.id}</Text>
          <Text style={[type.bodyStrong, { color: colors.textPrimary }]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Read task aloud"
          testID={`task-${task.id}-speak`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSpeak();
          }}
          style={[styles.speakerButton, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}
        >
          <SpeakerIcon color={colors.textSecondary} size={17} />
        </Pressable>
      </View>

      <View style={styles.taskMetaRow}>
        {task.status === "in_progress" ? <Badge label={t("today.inProgress")} tone="info" /> : null}
        <Badge label={riskLabel[task.risk]} tone={task.risk} />
        <Badge label={task.weather} tone="neutral" />
        {task.depth !== "—" ? <Badge label={`${t("task.depth")} ${task.depth}`} tone="neutral" /> : null}
      </View>

      {task.hazards.length ? (
        <View style={[styles.hazardBox, { backgroundColor: colors.cautionSoft }]}>
          <HazardIcon color={colors.caution} size={15} />
          <Text style={[type.small, { color: colors.textPrimary, flex: 1 }]}>{task.hazards.join(" · ")}</Text>
        </View>
      ) : null}

      <View style={[styles.estimateRow, { borderTopColor: colors.border }]}>
        <View style={[styles.riskBar, { backgroundColor: colorsForRisk[task.risk] }]} />
        <Text style={type.caption}>
          <Text style={{ color: colors.textMuted }}>{t("task.est")} </Text>
          <Text style={{ color: colors.textPrimary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{task.p50Min}</Text>
          <Text style={{ color: colors.textMuted }}>–{task.p90Min} {t("task.minRange")}</Text>
        </Text>
      </View>

      {offlineEstimate ? (
        // CLAUDE.md §3.1: offline re-scoring uses the on-device ONNX model and must be
        // marked "approximate (offline)" — never presented as equivalent to the
        // server's fully-informed, SHAP-explained estimate from morning sync.
        <Text style={[type.small, { fontStyle: "italic" }]}>
          <Text style={{ color: colors.textMuted }}>{t("task.reScoredOffline")} </Text>
          <Text style={{ color: colors.textSecondary, fontFamily: "Inter_700Bold" }}>{offlineEstimate.p50}</Text>
          <Text style={{ color: colors.textMuted }}>–{offlineEstimate.p90} {t("task.minApproximate")}</Text>
        </Text>
      ) : null}

      <View style={styles.actionsRow}>
        {task.status === "in_progress" ? (
          <>
            <PrimaryButton
              label={t("task.complete")}
              onPress={onComplete}
              variant="primary"
              fullWidth={false}
              testID={`task-${task.id}-complete`}
            />
            <PrimaryButton
              label={t("task.pause")}
              onPress={onPause}
              variant="secondary"
              fullWidth={false}
              testID={`task-${task.id}-pause`}
            />
          </>
        ) : (
          <PrimaryButton
            label={t("task.start")}
            onPress={onStart}
            variant="secondary"
            fullWidth={false}
            testID={`task-${task.id}-start`}
          />
        )}
      </View>
    </View>
  );
}

export function TodayScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const checkedCount = useChecklistStore((s) => s.checkedIds.size);
  const devNetworkCut = useConnectivityStore((s) => s.devNetworkCut);
  const connectivityStatus = useConnectivityStore((s) => s.status);
  const token = useAuthStore((s) => s.token);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
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

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const checklistDone = checkedCount === PRE_START_CHECKLIST.length;
  const firstName = DEMO_OPERATOR_NAME.split(" ")[0];

  return (
    <Page
      eyebrow={`${dateLabel} · Day shift`}
      title={`${greeting}, ${firstName}`}
      subtitle="Here's what's happening on your site today."
      status={{ label: "On shift", tone: "safe" }}
    >
      <Columns
        main={
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <MachineCard
                colors={colors}
                planLabel={(inProgress ?? tasks[0])?.title ?? "—"}
                checklistLabel={`${t("quickActions.preStartChecklist")} · ${t("quickActions.doneCount", {
                  done: checkedCount,
                  total: PRE_START_CHECKLIST.length,
                })}`}
                shiftLogLabel={t("quickActions.endOfShiftLog")}
              />
            </Animated.View>

            {inProgress ? (
              <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                <GlassCard glowColor={colors.info} style={styles.heroTask}>
                  <View style={styles.heroEyebrow}>
                    <View style={[styles.pulseDot, { backgroundColor: colors.info }]} />
                    <Text style={[type.label, { color: colors.info, fontSize: 10 }]}>{t("today.inProgress").toUpperCase()}</Text>
                  </View>
                  <TaskBody
                    task={inProgress}
                    colors={colors}
                    t={t}
                    onStart={() => changeTaskStatus(inProgress, "in_progress")}
                    onPause={() => changeTaskStatus(inProgress, "pending")}
                    onComplete={() => changeTaskStatus(inProgress, "done")}
                    onSpeak={() => speakTask(inProgress, t, language)}
                    offlineEstimate={offlineEstimates[inProgress.id]}
                  />
                </GlassCard>
              </Animated.View>
            ) : null}

            <SectionTitle title={t("today.upNext")} right={`${t("today.tasksScheduled", { count: tasks.length })} — ${t("today.reorderAnytime")}`} />
            <Grid cols={2}>
              {upcoming.map((task, i) => (
                <Animated.View key={task.id} entering={FadeInDown.delay(160 + i * 70).duration(400)}>
                  <Card>
                    <TaskBody
                      task={task}
                      colors={colors}
                      t={t}
                      onStart={() => changeTaskStatus(task, "in_progress")}
                      onPause={() => changeTaskStatus(task, "pending")}
                      onComplete={() => changeTaskStatus(task, "done")}
                      onSpeak={() => speakTask(task, t, language)}
                      offlineEstimate={offlineEstimates[task.id]}
                    />
                  </Card>
                </Animated.View>
              ))}
            </Grid>
          </>
        }
        side={
          <>
            <Animated.View entering={FadeInDown.delay(60).duration(400)}>
              <Card>
                <CardHeader
                  eyebrow="Your shift today"
                  title={doneCount === tasks.length && tasks.length > 0 ? "Day plan complete" : "On the right track"}
                  subtitle={`OP1001 · ${DEMO_MACHINE_ID}`}
                  right={<ShieldIcon color={colors.safe} size={20} />}
                />
                <View style={styles.progressTop}>
                  <ProgressRing
                    progress={tasks.length ? doneCount / tasks.length : 0}
                    size={96}
                    strokeWidth={9}
                    color={colors.safe}
                    trackColor={colors.ringTrack}
                    value={`${doneCount}/${tasks.length}`}
                    label="TASKS"
                    valueColor={colors.textPrimary}
                  />
                  <View style={styles.statusList}>
                    <StatusRow
                      ok={checklistDone}
                      label={`Pre-start checklist ${checkedCount}/${PRE_START_CHECKLIST.length}`}
                      colors={colors}
                    />
                    <StatusRow ok={doneCount === tasks.length && tasks.length > 0} label={`${doneCount}/${tasks.length} tasks complete`} colors={colors} />
                    <StatusRow
                      ok={!devNetworkCut && connectivityStatus === "online"}
                      label={devNetworkCut ? "Offline (dev mode)" : connectivityStatus === "online" ? "Synced" : "Syncing…"}
                      colors={colors}
                    />
                  </View>
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(400)}>
              <Card>
                <CardHeader eyebrow="Assistant insight" title="Weather watch" />
                <Text style={[type.caption, { color: colors.textSecondary, lineHeight: 20 }]}>
                  Rain moves in at 2pm — the Trenching task will likely overrun by ~15 min.
                </Text>
                <Pressable onPress={() => {}} style={styles.linkRow}>
                  <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>
                    Ask about today&apos;s plan
                  </Text>
                  <ArrowRightIcon color={colors.textPrimary} size={13} />
                </Pressable>
              </Card>
            </Animated.View>

            {!checklistDone ? (
              <Animated.View entering={FadeInDown.delay(160).duration(400)}>
                <View style={[styles.callout, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                  <View style={styles.calloutTitle}>
                    <ClipboardIcon color={colors.caution} size={16} />
                    <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>
                      Before you get moving
                    </Text>
                  </View>
                  <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                    Complete your pre-start walkaround — {PRE_START_CHECKLIST.length - checkedCount} of{" "}
                    {PRE_START_CHECKLIST.length} checks left.
                  </Text>
                  <Pressable onPress={() => router.push("/checklist")} style={styles.linkRow}>
                    <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_700Bold", textDecorationLine: "underline" }]}>
                      Review checklist
                    </Text>
                    <ArrowRightIcon color={colors.textPrimary} size={13} />
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}
          </>
        }
      />
    </Page>
  );
}

// Machine hero card — illustration band + unit facts + the two paperwork shortcuts
// (pre-start checklist and end-of-shift log, CLAUDE.md §2.1 Rule 5).
function MachineCard({
  colors,
  planLabel,
  checklistLabel,
  shiftLogLabel,
}: {
  colors: ReturnType<typeof useColors>;
  planLabel: string;
  checklistLabel: string;
  shiftLogLabel: string;
}) {
  const isWide = useIsWide();
  return (
    <Card style={styles.machineCard}>
      <MachineIllustration colors={colors} height={isWide ? 190 : 150} />
      <View style={styles.machineBody}>
        <View style={styles.machineTitleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.h1, { color: colors.textPrimary }]}>{DEMO_MACHINE_MODEL}</Text>
            <Text style={[type.caption, { color: colors.textSecondary }]}>Hydraulic excavator · Unit {DEMO_MACHINE_ID}</Text>
          </View>
          <Badge label="Operational" tone="safe" />
        </View>
        <Divider />
        <View style={styles.factsRow}>
          <Fact label="Shift hours" value="06:00 – 14:30" colors={colors} />
          <Fact label="Location" value="Sector B · East dig" colors={colors} icon={<PinIcon color={colors.textSecondary} size={13} />} />
          <Fact label="Today's plan" value={planLabel} colors={colors} />
        </View>
        <View style={styles.actionsRow}>
          <PrimaryButton
            testID="open-checklist"
            label={checklistLabel}
            onPress={() => router.push("/checklist")}
            variant="primary"
            fullWidth={false}
            iconRight
            icon={<ArrowRightIcon color={colors.accentOn} size={14} />}
          />
          <PrimaryButton
            testID="open-shift-log"
            label={shiftLogLabel}
            onPress={() => router.push("/shift-log")}
            variant="secondary"
            fullWidth={false}
          />
        </View>
      </View>
    </Card>
  );
}

function Fact({
  label,
  value,
  colors,
  icon,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.fact}>
      <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>{label.toUpperCase()}</Text>
      <View style={styles.factValue}>
        {icon}
        <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold", flexShrink: 1 }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// Side-view excavator drawn in SVG (no photo asset needed, scales crisply, themes).
function MachineIllustration({ colors, height }: { colors: ReturnType<typeof useColors>; height: number }) {
  const yellow = colors.accent;
  const dark = "#2B2620";
  return (
    <View style={[styles.illustration, { height }]}>
      <Svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.mode === "light" ? "#E9E3D6" : "#2A2721"} />
            <Stop offset="1" stopColor={colors.mode === "light" ? "#D9D1C0" : "#211E19"} />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={0} width={600} height={200} fill="url(#sky)" />
        <Path d="M0 160 L600 150 L600 200 L0 200 Z" fill={colors.mode === "light" ? "#BFB5A1" : "#3A352C"} />
        <Path d="M60 162 Q120 140 190 158 L190 170 L60 172 Z" fill={colors.mode === "light" ? "#A89D87" : "#4A4337"} />
        {/* tracks */}
        <Rect x={250} y={140} width={200} height={26} rx={13} fill={dark} />
        {[265, 290, 315, 340, 365, 390, 415, 435].map((cx) => (
          <Circle key={cx} cx={cx} cy={153} r={6} fill="#4A443B" />
        ))}
        {/* upper structure */}
        <Rect x={270} y={98} width={170} height={40} rx={6} fill={yellow} />
        <Rect x={420} y={104} width={34} height={30} rx={4} fill={yellow} />
        <Rect x={270} y={134} width={184} height={6} fill={dark} opacity={0.35} />
        {/* cab */}
        <Path d="M282 98 L282 58 Q282 52 288 52 L330 52 L344 98 Z" fill={yellow} />
        <Path d="M290 94 L290 60 L326 60 L337 94 Z" fill={dark} opacity={0.85} />
        {/* boom + stick + bucket */}
        <Path d="M300 104 L236 40 L220 50 L284 116 Z" fill={yellow} />
        <Path d="M236 40 L170 96 L182 106 L246 52 Z" fill={yellow} />
        <Path d="M168 94 L150 128 Q164 140 188 126 L186 104 Z" fill={dark} />
        <Circle cx={236} cy={44} r={6} fill={dark} />
        <Circle cx={292} cy={108} r={6} fill={dark} />
        <Rect x={354} y={112} width={46} height={8} rx={2} fill={dark} opacity={0.5} />
      </Svg>
      <View style={[styles.illustrationTag, { backgroundColor: colors.accent }]}>
        <Text style={[type.label, { color: colors.accentOn, fontSize: 9.5 }]}>YOUR MACHINE</Text>
      </View>
    </View>
  );
}

function StatusRow({ ok, label, colors }: { ok: boolean; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.statusRow}>
      {ok ? (
        <CheckIcon color={colors.safe} size={15} />
      ) : (
        <View style={[styles.pendingRing, { borderColor: colors.caution }]} />
      )}
      <Text style={[type.small, { color: ok ? colors.textPrimary : colors.caution, flexShrink: 1 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTask: {
    gap: spacing.sm,
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  statusList: {
    flex: 1,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingRing: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    marginHorizontal: 1,
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
    gap: 6,
  },
  speakerButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hazardBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm + 2,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm + 2,
  },
  riskBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  machineCard: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  illustration: {
    width: "100%",
    overflow: "hidden",
  },
  illustrationTag: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  machineBody: {
    padding: spacing.md + 2,
    gap: spacing.md,
  },
  machineTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  factsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  fact: {
    flex: 1,
    minWidth: 130,
    gap: 5,
  },
  factValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  callout: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calloutTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
