import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressRing } from "../components/ProgressRing";
import { ScreenBackground } from "../components/ScreenBackground";
import { downloadedLessons, trainingLibrary, type Lesson, type LessonCategory } from "../content/trainingLibrary";
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
                <View style={styles.heroPreview}>
                  <Text style={[type.caption, { color: colors.textMuted }]}>Unity viewport</Text>
                </View>
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
              <PrimaryButton label="Launch Ghost Operator" onPress={() => {}} variant="accent" />
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
                  <PrimaryButton label="Run scenario" onPress={() => {}} variant="secondary" fullWidth={false} />
                </Card>
              </Animated.View>
            ))}
          </View>

          <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
            <Text style={[type.h2, { color: colors.textPrimary }]}>Lesson library</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {trainingLibrary.length} lessons · {downloadedLessons().length} downloaded
            </Text>
          </View>
          <View style={styles.scenarioList}>
            {trainingLibrary.slice(0, 4).map((lesson, i) => (
              <Animated.View key={lesson.id} entering={FadeInDown.delay(420 + i * 60).duration(400)}>
                <LessonRow lesson={lesson} colors={colors} />
              </Animated.View>
            ))}
          </View>
          <PrimaryButton
            label={`See all ${trainingLibrary.length} lessons`}
            onPress={() => {}}
            variant="secondary"
            fullWidth={false}
          />

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Book an instructor</Text>
          <Card>
            <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>Next available slot</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>Fri 9:00 AM · site supervisor approval not required</Text>
            <PrimaryButton label="Request booking" onPress={() => {}} variant="secondary" fullWidth={false} />
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
    backgroundColor: "rgba(0,0,0,0.06)",
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
});
