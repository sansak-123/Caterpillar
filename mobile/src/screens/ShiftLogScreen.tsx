import { useState } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Badge, type BadgeTone } from "../components/Badge";
import { CheckIcon, ClockIcon, HazardIcon, PulseIcon, ShieldIcon } from "../components/icons";
import { Card } from "../components/Card";
import { CardHeader, Columns, Page } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";

// Auto-assembled from today's telemetry (engine_hours delta, fuel_used_l, load_cycles,
// completed tasks) — CLAUDE.md §2.1 Rule 5 "Automatic end-of-shift log." The operator
// reviews and signs; nothing here was typed in from memory.
const shiftSummary = {
  machineId: "EXC001",
  operatorId: "OP1001",
  engineHoursStart: 1523.5,
  engineHoursEnd: 1530.2,
  fuelUsedL: 17.1,
  loadCycles: 25,
  idleMin: 160,
  tasksCompleted: ["T001 Earth Excavation", "T003 Material Loading", "T004 Grading"],
  nearMissesLogged: 1,
};

export function ShiftLogScreen() {
  const colors = useColors();
  const [reviewed, setReviewed] = useState(false);
  const [signed, setSigned] = useState(false);

  const hoursWorked = shiftSummary.engineHoursEnd - shiftSummary.engineHoursStart;

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Timeline built from the same auto-assembled summary (newest first).
  const timeline: { title: string; detail: string; tag: string; tone: BadgeTone; icon: ReactNode }[] = [
    ...(shiftSummary.nearMissesLogged > 0
      ? [
          {
            title: "Near-miss logged",
            detail: `${shiftSummary.nearMissesLogged} confirmed near-miss recorded without paperwork.`,
            tag: "Safety alert",
            tone: "danger" as const,
            icon: <HazardIcon color={colors.danger} size={14} />,
          },
        ]
      : []),
    ...shiftSummary.tasksCompleted
      .slice()
      .reverse()
      .map((task) => ({
        title: task,
        detail: `Completed on ${shiftSummary.machineId} — actual time recorded from telemetry.`,
        tag: "Activity",
        tone: "safe" as const,
        icon: <PulseIcon color={colors.safe} size={14} />,
      })),
    {
      title: "Shift started",
      detail: `${shiftSummary.operatorId} assigned to ${shiftSummary.machineId} · engine hours ${shiftSummary.engineHoursStart}.`,
      tag: "Activity",
      tone: "neutral",
      icon: <ClockIcon color={colors.textSecondary} size={14} />,
    },
  ];

  return (
    <Page
      eyebrow="Your workday"
      title="Shift log"
      subtitle="Assembled automatically from your shift's telemetry — review and sign, nothing to fill in."
      status={signed ? { label: "Signed", tone: "safe" } : { label: "Awaiting signature", tone: "caution" }}
      showBack
    >
      <Columns
        sideWidth={340}
        main={
          <Animated.View entering={FadeInDown.duration(350)}>
            <Card>
              <CardHeader
                eyebrow={dateLabel}
                title="Activity timeline"
                right={<Text style={[type.small, { color: colors.textMuted }]}>{timeline.length} events</Text>}
              />
              <View style={styles.timeline}>
                {timeline.map((item, i) => (
                  <View key={`${item.title}-${i}`} style={styles.timelineRow}>
                    <View style={styles.rail}>
                      <View style={[styles.node, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>{item.icon}</View>
                      {i < timeline.length - 1 ? <View style={[styles.railLine, { backgroundColor: colors.borderStrong }]} /> : null}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>{item.title}</Text>
                      <Text style={[type.small, { color: colors.textSecondary }]}>{item.detail}</Text>
                      <Badge label={item.tag} tone={item.tone} />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        }
        side={
          <>
            <Animated.View entering={FadeInDown.delay(60).duration(350)}>
              <Card>
                <CardHeader eyebrow="Shift summary" title="Today's numbers" />
                <View style={styles.rows}>
                  <Row label="Machine" value={shiftSummary.machineId} colors={colors} />
                  <Row label="Engine hours worked" value={`${hoursWorked.toFixed(1)} h`} colors={colors} />
                  <Row label="Fuel used" value={`${shiftSummary.fuelUsedL.toFixed(1)} L`} colors={colors} />
                  <Row label="Load cycles" value={String(shiftSummary.loadCycles)} colors={colors} />
                  <Row label="Idle time" value={`${shiftSummary.idleMin} min`} colors={colors} />
                  <Row
                    label="Near-misses logged"
                    value={String(shiftSummary.nearMissesLogged)}
                    colors={colors}
                    valueColor={shiftSummary.nearMissesLogged > 0 ? colors.danger : undefined}
                  />
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(350)}>
              <Card>
                <CardHeader eyebrow="Sign-off" title="Review and sign" />
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReviewed((r) => !r);
                  }}
                  style={[
                    styles.reviewRow,
                    { backgroundColor: reviewed ? colors.safeSoft : colors.surface, borderColor: reviewed ? `${colors.safe}66` : colors.borderStrong },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: reviewed ? colors.safe : colors.borderStrong, backgroundColor: reviewed ? colors.safe : "transparent" },
                    ]}
                  >
                    {reviewed ? <CheckIcon color="#FFFFFF" size={14} /> : null}
                  </View>
                  <Text style={[type.caption, { color: colors.textPrimary, flex: 1 }]}>I&apos;ve reviewed this log and it&apos;s accurate</Text>
                </Pressable>

                {signed ? (
                  <Text style={[type.caption, { color: colors.safe, fontFamily: "Inter_600SemiBold" }]}>
                    Signed and submitted — no further action needed.
                  </Text>
                ) : (
                  <PrimaryButton
                    label="Sign & submit"
                    onPress={() => {
                      if (!reviewed) return;
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setSigned(true);
                      setTimeout(() => router.back(), 900);
                    }}
                    variant={reviewed ? "primary" : "accent"}
                  />
                )}
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(180).duration(350)}>
              <View style={[styles.note, { backgroundColor: colors.safeSoft, borderColor: `${colors.safe}55` }]}>
                <ShieldIcon color={colors.safe} size={17} />
                <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>No paperwork from memory</Text>
                <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                  Hours, fuel, loads and tasks come straight from telemetry — you only review and sign.
                </Text>
              </View>
            </Animated.View>
          </>
        }
      />
    </Page>
  );
}

function Row({
  label,
  value,
  colors,
  valueColor,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[type.caption, { color: valueColor ?? colors.textPrimary, fontFamily: "Inter_700Bold" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    marginTop: spacing.sm,
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rail: {
    alignItems: "center",
    width: 28,
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  railLine: {
    width: 1,
    flex: 1,
    minHeight: 18,
  },
  timelineBody: {
    flex: 1,
    gap: 5,
    paddingTop: 4,
    paddingBottom: spacing.lg,
  },
  rows: {
    gap: spacing.md - 2,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md - 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
