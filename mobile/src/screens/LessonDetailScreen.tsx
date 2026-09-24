import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { CheckIcon } from "../components/icons";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { YoutubeEmbed } from "../components/YoutubeEmbed";
import { trainingLibrary, type Lesson, type LessonCategory } from "../content/trainingLibrary";
import { useTrainingProgressStore } from "../store/trainingProgress";
import { useColors } from "../theme/useColors";
import { radius, spacing, touchTarget, type } from "../theme/tokens";

const categoryTone: Record<LessonCategory, "safe" | "caution" | "danger" | "info" | "neutral"> = {
  safety: "danger",
  efficiency: "caution",
  compliance: "info",
  onboarding: "neutral",
  skill: "safe",
};

export function LessonDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson: Lesson | undefined = trainingLibrary.find((l) => l.id === id);
  const completed = useTrainingProgressStore((s) => (lesson ? s.completedLessonIds.has(lesson.id) : false));
  const markLessonComplete = useTrainingProgressStore((s) => s.markLessonComplete);
  const markLessonIncomplete = useTrainingProgressStore((s) => s.markLessonIncomplete);

  if (!lesson) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.screen} edges={["top"]}>
          <Text style={[type.body, { color: colors.textPrimary, padding: spacing.md }]}>Lesson not found.</Text>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.backRow}
          >
            <Text style={[type.body, { color: colors.textSecondary }]}>{"‹ Back"}</Text>
          </Pressable>

          <View style={styles.headerRow}>
            <Text style={[type.display, { color: colors.textPrimary, flex: 1 }]}>{lesson.title}</Text>
            <Badge label={lesson.category} tone={categoryTone[lesson.category]} />
          </View>
          <Text style={[type.body, { color: colors.textMuted }]}>{lesson.summary}</Text>

          <View style={styles.metaRow}>
            <Badge label={`${lesson.durationMin} min`} tone="neutral" />
            <Badge label={lesson.languages.join("/")} tone="neutral" />
            <Badge label={lesson.videoUri ? "Video" : "Text lesson"} tone="neutral" />
            {lesson.downloadedOffline ? <Badge label="Downloaded" tone="safe" /> : null}
          </View>

          {lesson.videoUri ? (
            <View style={{ gap: spacing.xs }}>
              <YoutubeEmbed videoId={lesson.videoUri} />
              {lesson.videoSource ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>{lesson.videoSource}</Text>
              ) : null}
            </View>
          ) : null}

          <Card>
            <Text style={[type.caption, { color: colors.textMuted }]}>OBJECTIVE</Text>
            <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{lesson.objective}</Text>
          </Card>

          <View style={{ gap: spacing.sm }}>
            {lesson.body.map((paragraph, i) => (
              <Text key={i} style={[type.body, { color: colors.textPrimary, lineHeight: 24 }]}>
                {paragraph}
              </Text>
            ))}
          </View>

          <Card>
            <Text style={[type.caption, { color: colors.textMuted }]}>KEY STEPS</Text>
            {lesson.keySteps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={[type.bodyStrong, { color: colors.accent }]}>{i + 1}.</Text>
                <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>{step}</Text>
              </View>
            ))}
            {lesson.standardRef ? (
              <Text style={[type.caption, { color: colors.textMuted }]}>Reference: {lesson.standardRef}</Text>
            ) : null}
          </Card>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (completed) markLessonIncomplete(lesson.id);
              else markLessonComplete(lesson.id);
            }}
            style={[
              styles.completeRow,
              { borderColor: completed ? colors.safe : colors.border, backgroundColor: completed ? `${colors.safe}17` : colors.surface },
            ]}
          >
            <View
              style={[
                styles.completeCheckbox,
                { borderColor: completed ? colors.safe : colors.border, backgroundColor: completed ? colors.safe : "transparent" },
              ]}
            >
              {completed ? <CheckIcon color={colors.mode === "light" ? "#FFFFFF" : colors.bg} size={16} /> : null}
            </View>
            <Text style={[type.bodyStrong, { color: completed ? colors.safe : colors.textPrimary }]}>
              {completed ? "Completed" : "Mark as complete"}
            </Text>
          </Pressable>

          <PrimaryButton label="Back to library" onPress={() => router.back()} variant="secondary" />
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  backRow: {
    minHeight: touchTarget,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  completeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
