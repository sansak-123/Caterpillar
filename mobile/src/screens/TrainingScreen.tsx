import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ArrowRightIcon, BookIcon, CheckIcon, ClockIcon, MonitorIcon, TrendIcon, UserIcon } from "../components/icons";
import { InsightCard } from "../components/InsightCard";
import { CardHeader, Columns, Grid, IconTile, Page, SectionTitle } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
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
import { radius, spacing, type } from "../theme/tokens";

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

  const featured = scenarios.find((sc) => sc.id === "NearMissReplay") ?? scenarios[0];
  const otherScenarios = scenarios.filter((sc) => sc.id !== featured.id);
  const lessonPct = trainingLibrary.length ? completedLessonIds.size / trainingLibrary.length : 0;

  const toggleLesson = (lesson: Lesson) =>
    completedLessonIds.has(lesson.id) ? markLessonIncomplete(lesson.id) : markLessonComplete(lesson.id);

  return (
    <Page
      eyebrow="Keep learning"
      title="Safety training"
      subtitle="Simulator scenarios and lessons, downloadable for offline use."
      status={completedLessonIds.size > 0 ? { label: "Learning on track", tone: "safe" } : { label: "Get started", tone: "caution" }}
    >
      <Columns
        sideWidth={340}
        main={
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <InsightCard
                eyebrow="Featured exercise"
                headline={featured.title}
                body={featured.description}
                actionLabel="Start replay"
                onPress={() => router.push({ pathname: "/simulator", params: { scenario: featured.id } })}
              />
            </Animated.View>

            <SectionTitle title="Practice scenarios" right={`${scenarios.length} in the simulator`} />
            <Grid cols={2}>
              {otherScenarios.map((sc, i) => (
                <Animated.View key={sc.id} entering={FadeInDown.delay(80 + i * 60).duration(400)} style={styles.fill}>
                  <Card style={styles.fill}>
                    <View style={styles.rowBetween}>
                      <IconTile bg={sc.tag === "Recommended" ? colors.accentSoft : colors.surfaceRaised}>
                        <MonitorIcon color={colors.textPrimary} size={17} />
                      </IconTile>
                      {sc.tag === "Recommended" ? (
                        <Badge label={sc.tag} tone="safe" />
                      ) : (
                        <Text style={[type.small, { color: colors.textMuted }]}>{sc.tag}</Text>
                      )}
                    </View>
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>SIMULATOR</Text>
                    <Text style={[type.bodyStrong, { color: colors.textPrimary, marginTop: -4 }]}>{sc.title}</Text>
                    <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18, flex: 1 }]}>{sc.description}</Text>
                    <PrimaryButton
                      label="Run scenario"
                      onPress={() => router.push({ pathname: "/simulator", params: { scenario: sc.id } })}
                      variant={sc.tag === "Recommended" ? "primary" : "secondary"}
                      iconRight
            icon={<ArrowRightIcon color={sc.tag === "Recommended" ? colors.accentOn : colors.textPrimary} size={14} />}
                    />
                  </Card>
                </Animated.View>
              ))}
            </Grid>

            <SectionTitle title="New operator pathway" right={`${firstWeekPath.length} lessons · first week`} />
            <View style={[styles.callout, { backgroundColor: colors.infoSoft, borderColor: `${colors.info}40` }]}>
              <BookIcon color={colors.info} size={17} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>
                  Learn before independent operation
                </Text>
                <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                  Complete this guided path with your trainer. The machine manual and site procedure always come first.
                </Text>
              </View>
            </View>
            <Grid cols={2}>
              {firstWeekPath.map((lesson, i) => (
                <Animated.View key={lesson.id} entering={FadeInDown.delay(200 + i * 50).duration(400)} style={styles.fill}>
                  <LessonRow
                    lesson={lesson}
                    colors={colors}
                    completed={completedLessonIds.has(lesson.id)}
                    onToggleComplete={() => toggleLesson(lesson)}
                  />
                </Animated.View>
              ))}
            </Grid>
            <PrimaryButton
              label={showRefreshers ? "Hide practice and refresher lessons" : `Show ${trainingLibrary.length - firstWeekPath.length} more lessons`}
              onPress={() => setShowRefreshers((shown) => !shown)}
              variant="secondary"
              fullWidth={false}
            />
            {showRefreshers ? (
              <Grid cols={2}>
                {trainingLibrary
                  .filter((lesson) => !firstWeekPath.some((starter) => starter.id === lesson.id))
                  .map((lesson, i) => (
                    <Animated.View key={lesson.id} entering={FadeInDown.delay(i * 50).duration(350)} style={styles.fill}>
                      <LessonRow
                        lesson={lesson}
                        colors={colors}
                        completed={completedLessonIds.has(lesson.id)}
                        onToggleComplete={() => toggleLesson(lesson)}
                      />
                    </Animated.View>
                  ))}
              </Grid>
            ) : null}
          </>
        }
        side={
          <>
            <Animated.View entering={FadeInDown.delay(60).duration(400)}>
              <Card>
                <CardHeader title="Your progress" right={<TrendIcon color={colors.safe} size={18} />} />
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
                <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
                  <Text style={[type.small, { color: colors.textSecondary }]}>Library progress</Text>
                  <Text style={[type.small, { color: colors.safe, fontFamily: "Inter_700Bold" }]}>{Math.round(lessonPct * 100)}%</Text>
                </View>
                <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
                  <View style={[styles.trackFill, { width: `${lessonPct * 100}%`, backgroundColor: colors.safe }]} />
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(400)}>
              <Card>
                <CardHeader eyebrow="One-to-one" title="Book an instructor" right={<UserIcon color={colors.textSecondary} size={18} />} />
                {booking.status === "done" ? (
                  <>
                    <View style={styles.rowBetween}>
                      <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>Booking requested</Text>
                      <Badge label={booking.result.status} tone="info" />
                    </View>
                    <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>{booking.result.reply}</Text>
                    <View style={[styles.slot, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
                      <ClockIcon color={colors.textSecondary} size={14} />
                      <Text style={[type.small, { color: colors.textPrimary }]}>
                        {new Date(booking.result.slot_start).toLocaleString()} –{" "}
                        {new Date(booking.result.slot_end).toLocaleTimeString()}
                      </Text>
                    </View>
                    <PrimaryButton label="Request another slot" onPress={requestBooking} variant="secondary" />
                  </>
                ) : (
                  <>
                    <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                      Books the next available instructor slot — needs a connection, same as the assistant&apos;s booking.
                    </Text>
                    {booking.status === "error" ? (
                      <Text style={[type.small, { color: colors.danger }]}>{booking.message}</Text>
                    ) : null}
                    <PrimaryButton
                      label={booking.status === "loading" ? "Requesting…" : "Request booking"}
                      onPress={requestBooking}
                      variant="primary"
                    />
                  </>
                )}
              </Card>
            </Animated.View>
          </>
        }
      />
    </Page>
  );
}

function ProgressStat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.progressCell}>
      <Text style={[type.metric, { color: colors.textPrimary, fontSize: 22 }]}>{value}</Text>
      <Text style={[type.small, { color: colors.textMuted }]}>{label}</Text>
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
    <Card style={styles.fill}>
      <Pressable
        onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: lesson.id } })}
        style={{ gap: spacing.sm, flex: 1 }}
      >
        <View style={styles.rowBetween}>
          <IconTile bg={colors.surfaceRaised}>
            <BookIcon color={colors.textPrimary} size={17} />
          </IconTile>
          {completed ? (
            <Badge label="Complete" tone="safe" />
          ) : (
            <Text style={[type.small, { color: colors.textMuted }]}>{lesson.videoUri ? "Video" : "Text lesson"}</Text>
          )}
        </View>
        <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>{lesson.category.toUpperCase()}</Text>
        <Text style={[type.bodyStrong, { color: colors.textPrimary, marginTop: -4 }]} numberOfLines={2}>
          {lesson.title}
        </Text>
        <View style={styles.metaRow}>
          <ClockIcon color={colors.textMuted} size={12} />
          <Text style={[type.small, { color: colors.textMuted }]}>
            {lesson.durationMin} min · {lesson.languages.join("/")}
            {lesson.standardRef ? ` · ${lesson.standardRef}` : ""}
          </Text>
        </View>
        <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]} numberOfLines={2}>
          {lesson.summary}
        </Text>
        <View style={[styles.objectiveBox, { backgroundColor: colors.surfaceSunken }]}>
          <Text style={[type.label, { color: colors.textMuted, fontSize: 9.5 }]}>YOU WILL LEARN</Text>
          <Text style={[type.small, { color: colors.textPrimary }]}>{lesson.objective}</Text>
        </View>
        <Text style={[type.small, { color: colors.textMuted }]} numberOfLines={2}>
          Key steps: {lesson.keySteps.slice(0, 2).join(" · ")}
        </Text>
        <View style={styles.badgeRow}>
          {/* A handful of lessons now have a real embedded video (see
              trainingLibrary.ts) — this reflects which, honestly, per lesson. */}
          <Badge label={lesson.category} tone={categoryTone[lesson.category]} />
          {lesson.downloadedOffline ? <Badge label="Downloaded" tone="safe" /> : null}
        </View>
        <View style={styles.rowBetween}>
          <Text style={[type.small, { color: colors.textSecondary }]}>Progress</Text>
          <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>{completed ? "100%" : "0%"}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
          <View style={[styles.trackFill, { width: completed ? "100%" : "0%", backgroundColor: colors.safe }]} />
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onToggleComplete();
        }}
        style={({ hovered }) => [
          styles.completeRow,
          {
            borderColor: completed ? colors.border : colors.borderStrong,
            backgroundColor: completed ? colors.surfaceSunken : hovered ? colors.surfaceRaised : colors.surface,
          },
        ]}
      >
        {completed ? <CheckIcon color={colors.textMuted} size={14} /> : null}
        <Text style={[type.small, { color: completed ? colors.textMuted : colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>
          {completed ? "Completed" : "Mark as complete"}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  objectiveBox: {
    gap: 3,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  callout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.md,
    marginTop: spacing.xs,
  },
  progressCell: {
    width: "50%",
    gap: 2,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: spacing.sm + 4,
    marginTop: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 3,
  },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
});
