import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { GlassCard } from "../components/GlassCard";
import { TrainingIcon } from "../components/icons";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressRing } from "../components/ProgressRing";
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
  const colors = useColors();
  const token = useAuthStore((s) => s.token);
  const language = useLanguageStore((s) => s.language);
  const firstWeekPath = beginnerPath();
  const [showRefreshers, setShowRefreshers] = useState(false);
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
          <Text style={[type.display, { color: colors.textPrimary }]}>Ghost Operator</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Unity simulator scenarios, downloadable for offline use.
          </Text>

          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard glowColor={colors.accentGlow} style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Pressable
                  style={[styles.heroPreview, { backgroundColor: colors.accent }]}
                  onPress={() => router.push({ pathname: "/simulator", params: { scenario: "GhostOperator" } })}
                  accessibilityRole="button"
                  accessibilityLabel="Launch Ghost Operator"
                >
                  <View style={[styles.playCircle, { backgroundColor: colors.accentOn }]}>
                    <TrainingIcon color={colors.accent} size={22} />
                  </View>
                  <Text style={[type.caption, { color: colors.accentOn, fontWeight: "700" }]}>Ghost Operator</Text>
                </Pressable>
                <ProgressRing
                  progress={0.82}
                  size={84}
                  strokeWidth={8}
                  color={colors.accent}
                  trackColor={colors.ringTrack}
                  value="0.82"
                  label="skill"
                  valueColor={colors.textPrimary}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Your skill factor</Text>
                <Badge label="Goal 0.90" tone="info" />
              </View>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Closing the gap with the ghost improves your task-time estimates automatically.
              </Text>
              <PrimaryButton
                label="Launch Ghost Operator"
                onPress={() => router.push({ pathname: "/simulator", params: { scenario: "GhostOperator" } })}
                variant="accent"
              />
            </GlassCard>
          </Animated.View>

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>All scenarios</Text>
          <View style={styles.scenarioList}>
            {scenarios.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(120 + i * 70).duration(400)}>
                <Card>
                  <View style={styles.rowBetween}>
                    <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{s.title}</Text>
                    <Badge label={s.tag} tone={s.tag === "New from today" ? "danger" : "neutral"} />
                  </View>
                  <Text style={[type.body, { color: colors.textMuted }]}>{s.description}</Text>
                  <PrimaryButton
                    label="Run scenario"
                    onPress={() => router.push({ pathname: "/simulator", params: { scenario: s.id } })}
                    variant="secondary"
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
                <LessonRow lesson={lesson} colors={colors} />
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
                    <LessonRow lesson={lesson} colors={colors} />
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

function LessonRow({ lesson, colors }: { lesson: Lesson; colors: ReturnType<typeof useColors> }) {
  return (
    <Card>
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
        {lesson.downloadedOffline ? <Badge label="Downloaded" tone="safe" /> : null}
      </View>
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
  heroCard: {
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroPreview: {
    flex: 1,
    height: 100,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
});
