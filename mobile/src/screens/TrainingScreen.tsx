import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { CheckIcon } from "../components/icons";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import {
  beginnerPath,
  trainingLibrary,
  type Lesson,
  type LessonCategory,
} from "../content/trainingLibrary";
import { postBookingRequest, type BookingResponse } from "../lib/api/client";
import { useAuthStore } from "../store/auth";
import { useLanguageStore } from "../store/language";
import { formatPracticeDuration, totalPracticeSeconds, useTrainingProgressStore } from "../store/trainingProgress";
import { useColors } from "../theme/useColors";
import { radius, spacing, touchTarget, type } from "../theme/tokens";

const categoryTone: Record<LessonCategory, "safe" | "caution" | "danger" | "info" | "neutral"> = {
  safety: "danger",
  efficiency: "caution",
  compliance: "info",
  onboarding: "neutral",
  skill: "safe",
};

type Scenario = {
  id: string;
  title: string;
  description: string;
  tag: string;
};

const scenarios: Scenario[] = [
  {
    id: "GhostOperator",
    title: "Train with Expert",
    description: "Dig alongside a replay of an expert operator's cycle. Scored on time, smoothness, fuel/cycle.",
    tag: "Recommended",
  },
  {
    id: "NearMissReplay",
    title: "Near-Miss Replay",
    description:
      "Drive near workers with live red/amber zones — near-misses are captured automatically, then relived in slow motion so you can try it again.",
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
  {
    id: "WelfareCheck",
    title: "Operator Check-in",
    description:
      "A soft, voice-answerable \"Are you OK?\" when the controls go untouched too long. No answer escalates to a welfare check — never a discipline flag.",
    tag: "USP-6",
  },
];

export function TrainingScreen() {
  const colors = useColors();
  const token = useAuthStore((s) => s.token);
  const language = useLanguageStore((s) => s.language);
  const firstWeekPath = beginnerPath();
  const [showRefreshers, setShowRefreshers] = useState(false);
  const completedLessonIds = useTrainingProgressStore((s) => s.completedLessonIds);
  const markLessonComplete = useTrainingProgressStore((s) => s.markLessonComplete);
  const markLessonIncomplete = useTrainingProgressStore((s) => s.markLessonIncomplete);
  const sessions = useTrainingProgressStore((s) => s.sessions);
  const bestSkillFactor = sessions.length ? Math.max(...sessions.map((s) => s.skillFactor)) : null;
  const [booking, setBooking] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; result: BookingResponse }
  >({ status: "idle" });

  async function requestBooking() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!token) {
      setBooking({ status: "error", message: "Sign-in required — try again once the app has connected." });
      return;
    }
    setBooking({ status: "loading" });
    try {
      const result = await postBookingRequest(token, {
        message: "book me the next available instructor slot",
        language,
      });
      setBooking({ status: "done", result });
    } catch {
      setBooking({ status: "error", message: "Couldn't reach the booking service — try again shortly." });
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>TRAINING</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Practice &amp; learn</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Simulator scenarios and lessons, downloadable for offline use.
          </Text>

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Your progress</Text>
          <Card>
            <View style={styles.progressGrid}>
              <ProgressStat
                label="Lessons completed"
                value={`${completedLessonIds.size}/${trainingLibrary.length}`}
                colors={colors}
              />
              <ProgressStat label="Practice sessions" value={String(sessions.length)} colors={colors} />
              <ProgressStat
                label="Practice time"
                value={sessions.length ? formatPracticeDuration(totalPracticeSeconds(sessions)) : "—"}
                colors={colors}
              />
              <ProgressStat
                label="Best skill factor"
                value={bestSkillFactor !== null ? bestSkillFactor.toFixed(2) : "—"}
                colors={colors}
              />
            </View>
          </Card>

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Practice scenarios</Text>
          <View style={styles.scenarioList}>
            {scenarios.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(120 + i * 70).duration(400)}>
                <Card accentColor={s.tag === "Recommended" ? colors.accent : undefined}>
                  <View style={styles.rowBetween}>
                    <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{s.title}</Text>
                    <Badge label={s.tag} tone={s.tag === "New from today" ? "danger" : "neutral"} />
                  </View>
                  <Text style={[type.body, { color: colors.textMuted }]}>{s.description}</Text>
                  <PrimaryButton
                    label="Run scenario"
                    onPress={() => router.push({ pathname: "/simulator", params: { scenario: s.id } })}
                    variant={s.tag === "Recommended" ? "accent" : "secondary"}
                    fullWidth={false}
                  />
                </Card>
              </Animated.View>
            ))}
          </View>

          <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
            <Text style={[type.h2, { color: colors.textPrimary }]}>New operator pathway</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {firstWeekPath.length} lessons · first week
            </Text>
          </View>
          <Card accentColor={colors.info}>
            <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>Learn before independent operation</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>
              Complete this guided path with your trainer. The machine manual and site procedure always come first.
            </Text>
          </Card>
          <View style={styles.scenarioList}>
            {firstWeekPath.map((lesson, i) => (
              <Animated.View key={lesson.id} entering={FadeInDown.delay(420 + i * 60).duration(400)}>
                <LessonRow
                  lesson={lesson}
                  colors={colors}
                  completed={completedLessonIds.has(lesson.id)}
                  onToggleComplete={() =>
                    completedLessonIds.has(lesson.id) ? markLessonIncomplete(lesson.id) : markLessonComplete(lesson.id)
                  }
                />
              </Animated.View>
            ))}
          </View>
          <PrimaryButton
            label={showRefreshers ? "Hide practice and refresher lessons" : `Show ${trainingLibrary.length - firstWeekPath.length} more lessons`}
            onPress={() => setShowRefreshers((shown) => !shown)}
            variant="secondary"
            fullWidth={false}
          />
          {showRefreshers ? (
            <View style={styles.scenarioList}>
              {trainingLibrary
                .filter((lesson) => !firstWeekPath.some((starter) => starter.id === lesson.id))
                .map((lesson, i) => (
                  <Animated.View key={lesson.id} entering={FadeInDown.delay(i * 60).duration(350)}>
                    <LessonRow
                      lesson={lesson}
                      colors={colors}
                      completed={completedLessonIds.has(lesson.id)}
                      onToggleComplete={() =>
                        completedLessonIds.has(lesson.id) ? markLessonIncomplete(lesson.id) : markLessonComplete(lesson.id)
                      }
                    />
                  </Animated.View>
                ))}
            </View>
          ) : null}

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Book an instructor</Text>
          <Card>
            {booking.status === "done" ? (
              <>
                <View style={styles.rowBetween}>
                  <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>Booking requested</Text>
                  <Badge label={booking.result.status} tone="info" />
                </View>
                <Text style={[type.body, { color: colors.textMuted }]}>{booking.result.reply}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {new Date(booking.result.slot_start).toLocaleString()} –{" "}
                  {new Date(booking.result.slot_end).toLocaleTimeString()}
                </Text>
                <PrimaryButton
                  label="Request another slot"
                  onPress={requestBooking}
                  variant="secondary"
                  fullWidth={false}
                />
              </>
            ) : (
              <>
                <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>Request a slot</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  Books the next available instructor slot — needs a connection, same as the assistant&apos;s booking.
                </Text>
                {booking.status === "error" ? (
                  <Text style={[type.caption, { color: colors.danger }]}>{booking.message}</Text>
                ) : null}
                <PrimaryButton
                  label={booking.status === "loading" ? "Requesting…" : "Request booking"}
                  onPress={requestBooking}
                  variant="secondary"
                  fullWidth={false}
                />
              </>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function ProgressStat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.progressCell}>
      <Text style={[type.h2, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function LessonRow({
  lesson,
  colors,
  completed,
  onToggleComplete,
}: {
  lesson: Lesson;
  colors: ReturnType<typeof useColors>;
  completed: boolean;
  onToggleComplete: () => void;
}) {
  return (
    <Card accentColor={completed ? colors.safe : undefined}>
      <Pressable
        onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: lesson.id } })}
        style={{ gap: spacing.sm }}
      >
        <View style={styles.rowBetween}>
          <Text style={[type.bodyStrong, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
            {lesson.title}
          </Text>
          <Badge label={lesson.category} tone={categoryTone[lesson.category]} />
        </View>
        <Text style={[type.body, { color: colors.textMuted }]} numberOfLines={2}>
          {lesson.summary}
        </Text>
        <View style={styles.objectiveBox}>
          <Text style={[type.caption, { color: colors.textMuted }]}>YOU WILL LEARN</Text>
          <Text style={[type.caption, { color: colors.textPrimary }]}>{lesson.objective}</Text>
        </View>
        <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={2}>
          Key steps: {lesson.keySteps.slice(0, 2).join(" · ")}
        </Text>
        <View style={styles.rowBetween}>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {lesson.durationMin} min · {lesson.languages.join("/")}
            {lesson.standardRef ? ` · ${lesson.standardRef}` : ""}
          </Text>
          <View style={styles.rowBetween}>
            {/* A handful of lessons now have a real embedded video (see
                trainingLibrary.ts) — this reflects which, honestly, per lesson. */}
            <Badge label={lesson.videoUri ? "Video" : "Text lesson"} tone="neutral" />
            {lesson.downloadedOffline ? <Badge label="Downloaded" tone="safe" /> : null}
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onToggleComplete();
        }}
        style={[
          styles.completeRow,
          { borderColor: completed ? colors.safe : colors.border, backgroundColor: completed ? `${colors.safe}17` : "transparent" },
        ]}
      >
        <View
          style={[
            styles.completeCheckbox,
            { borderColor: completed ? colors.safe : colors.border, backgroundColor: completed ? colors.safe : "transparent" },
          ]}
        >
          {completed ? <CheckIcon color={colors.mode === "light" ? "#FFFFFF" : colors.bg} size={14} /> : null}
        </View>
        <Text style={[type.caption, { color: completed ? colors.safe : colors.textSecondary, fontWeight: "700" }]}>
          {completed ? "Completed" : "Mark as complete"}
        </Text>
      </Pressable>
    </Card>
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  scenarioList: {
    gap: spacing.sm,
  },
  objectiveBox: {
    gap: 2,
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  progressCell: {
    minWidth: "40%",
    flexGrow: 1,
    gap: 2,
  },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  completeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
