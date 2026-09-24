import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { CheckIcon, ClockIcon } from "../components/icons";
import { CardHeader, Columns, Page } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
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
      <Page title="Lesson not found." showBack="always">
        <PrimaryButton label="Back to library" onPress={() => router.back()} variant="secondary" fullWidth={false} />
      </Page>
    );
  }

  return (
    <Page
      eyebrow={`Training · ${lesson.category}`}
      title={lesson.title}
      subtitle={lesson.summary}
      right={<Badge label={lesson.category} tone={categoryTone[lesson.category]} />}
      showBack="always"
    >
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <ClockIcon color={colors.textMuted} size={13} />
          <Text style={[type.small, { color: colors.textSecondary }]}>{lesson.durationMin} min</Text>
        </View>
        <Badge label={lesson.languages.join("/")} tone="neutral" />
        <Badge label={lesson.videoUri ? "Video" : "Text lesson"} tone="neutral" />
        {lesson.downloadedOffline ? <Badge label="Downloaded" tone="safe" /> : null}
      </View>

      <Columns
        sideWidth={340}
        main={
          <>
            {lesson.videoUri ? (
              <Card style={styles.videoCard}>
                <YoutubeEmbed videoId={lesson.videoUri} />
                {lesson.videoSource ? (
                  <Text style={[type.small, { color: colors.textMuted, padding: spacing.md - 2 }]}>{lesson.videoSource}</Text>
                ) : null}
              </Card>
            ) : null}

            <Card>
              <CardHeader eyebrow="Lesson" title="What to know" />
              {lesson.body.map((paragraph, i) => (
                <Text key={i} style={[type.body, { color: colors.textPrimary, lineHeight: 24 }]}>
                  {paragraph}
                </Text>
              ))}
            </Card>
          </>
        }
        side={
          <>
            <View style={[styles.objective, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[type.label, { color: colors.textSecondary, fontSize: 10 }]}>OBJECTIVE</Text>
              <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold", lineHeight: 20 }]}>
                {lesson.objective}
              </Text>
            </View>

            <Card>
              <CardHeader eyebrow="Checklist" title="Key steps" />
              {lesson.keySteps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.accent }]}>
                    <Text style={[type.small, { color: colors.accentOn, fontFamily: "Inter_700Bold", fontSize: 11 }]}>{i + 1}</Text>
                  </View>
                  <Text style={[type.caption, { color: colors.textPrimary, flex: 1, lineHeight: 20 }]}>{step}</Text>
                </View>
              ))}
              {lesson.standardRef ? (
                <Text style={[type.small, { color: colors.textMuted }]}>Reference: {lesson.standardRef}</Text>
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
                { borderColor: completed ? `${colors.safe}66` : colors.borderStrong, backgroundColor: completed ? colors.safeSoft : colors.surface },
              ]}
            >
              <View
                style={[
                  styles.completeCheckbox,
                  { borderColor: completed ? colors.safe : colors.borderStrong, backgroundColor: completed ? colors.safe : "transparent" },
                ]}
              >
                {completed ? <CheckIcon color="#FFFFFF" size={14} /> : null}
              </View>
              <Text style={[type.caption, { color: completed ? colors.safe : colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>
                {completed ? "Completed" : "Mark as complete"}
              </Text>
            </Pressable>

            <PrimaryButton label="Back to library" onPress={() => router.back()} variant="secondary" />
          </>
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  videoCard: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  objective: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    minHeight: touchTarget,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  completeCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
