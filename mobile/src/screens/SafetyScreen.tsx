import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import {
  fatigueAlert,
  machineHealthAlert,
  worstSeverity,
  slopeAlert,
  responsivenessCheck,
  idlePromptCopy,
  idleConfirmationCopy,
  IDLE_REASON_OPTIONS,
  type IdleReason,
} from "../lib/safety";
import { useColors } from "../theme/useColors";
import { spacing, type } from "../theme/tokens";

const RADAR_SIZE = 260;
const CENTER = RADAR_SIZE / 2;

// Mock state reproducing the seed 10:00 scenario: seatbelt unfastened, worker approaching
// through the rear blind spot while swinging — this is what lib/safety (Phase 5) will compute
// on-device from real telemetry. The USP-6 cards below call the real lib/safety functions
// against representative mock inputs, so the logic is genuine even though the input isn't live
// telemetry yet.
const mockWorker = { angleDeg: 150, distanceRatio: 0.55 };

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function RadarView({ colors }: { colors: ReturnType<typeof useColors> }) {
  const worker = polarToXY(mockWorker.angleDeg, mockWorker.distanceRatio * (CENTER - 20));
  const blindSpotStart = polarToXY(120, CENTER - 4);
  const blindSpotEnd = polarToXY(240, CENTER - 4);
  const machineFill = colors.mode === "light" ? "#4B4F58" : colors.textSecondary;
  const wedgeFill = colors.mode === "light" ? "rgba(20,20,20,0.05)" : "rgba(255,255,255,0.05)";

  return (
    <View style={styles.radarWrap}>
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        <Circle cx={CENTER} cy={CENTER} r={CENTER - 4} fill={`${colors.safe}14`} stroke={colors.safe} strokeWidth={1.5} />
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={(CENTER - 4) * 0.66}
          fill={`${colors.caution}1A`}
          stroke={colors.caution}
          strokeWidth={1.5}
        />
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={(CENTER - 4) * 0.33}
          fill={`${colors.danger}22`}
          stroke={colors.danger}
          strokeWidth={1.5}
        />

        <Polygon
          points={`${CENTER},${CENTER} ${blindSpotStart.x},${blindSpotStart.y} ${blindSpotEnd.x},${blindSpotEnd.y}`}
          fill={wedgeFill}
        />

        <Path
          d={`M ${CENTER - 14} ${CENTER + 16} L ${CENTER + 14} ${CENTER + 16} L ${CENTER + 10} ${CENTER - 10} L ${CENTER - 10} ${CENTER - 10} Z`}
          fill={machineFill}
        />
        <Path d={`M ${CENTER} ${CENTER - 10} L ${CENTER} ${CENTER - 42}`} stroke={colors.accent} strokeWidth={4} strokeLinecap="round" />

        <Circle cx={worker.x} cy={worker.y} r={7} fill={colors.danger} />
        <Circle cx={worker.x} cy={worker.y} r={13} fill="none" stroke={colors.danger} strokeWidth={2} opacity={0.55} />
      </Svg>
    </View>
  );
}

const severityTone: Record<"ok" | "caution" | "danger", "safe" | "caution" | "danger"> = {
  ok: "safe",
  caution: "caution",
  danger: "danger",
};

export function SafetyScreen() {
  const colors = useColors();
  const [idleTagged, setIdleTagged] = useState<IdleReason | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  // Representative mock inputs standing in for live telemetry (Phase 4/5 wires the real feed).
  const fatigue = fatigueAlert(0.72, 6.5);
  const machineFlags = machineHealthAlert({
    hydraulicPressureBar: 338,
    hydraulicOilTempC: 98,
    coolantTempC: 111,
    defLevelPct: 22,
    faultCodeActive: false,
    hoursSinceLastService: 540,
    serviceIntervalHrs: 500,
  });
  const machineSeverity = worstSeverity(machineFlags);
  const slope = slopeAlert(28, 45, 200);
  const responsiveness = responsivenessCheck({
    engineOn: true,
    seatbeltFastened: true,
    travelKmh: 0.05,
    swingRateDps: 0.1,
    boomDeltaDegPerMin: 0.2,
    stickDeltaDegPerMin: 0.1,
    bucketDeltaDegPerMin: 0,
    stationaryMinutes: 18,
  });
  const idlePrompt = idlePromptCopy(5);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>SAFETY</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Live proximity</Text>

          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard glowColor={colors.dangerGlow} style={styles.alertCard}>
              <View style={styles.alertHeaderRow}>
                <Badge label="RED ZONE" tone="danger" />
                <Text style={[type.caption, { color: colors.textMuted }]}>Rear sector · swing in progress</Text>
              </View>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Worker in blind spot while swinging</Text>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Zone radius widened for current visibility (2.1 km) and wind (18 km/h).
              </Text>

              <RadarView colors={colors} />

              <View style={styles.legendRow}>
                <Badge label="Green" tone="safe" />
                <Badge label="Amber" tone="caution" />
                <Badge label="Red · rear-weighted" tone="danger" />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Card>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Seatbelt</Text>
              <View style={styles.rowBetween}>
                <Text style={[type.body, { color: colors.textMuted }]}>Status</Text>
                <Badge label="Unfastened" tone="danger" />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[type.body, { color: colors.textMuted }]}>Engine / travel</Text>
                <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>On · traveling</Text>
              </View>
            </Card>
          </Animated.View>

          {responsiveness.shouldCheckIn && !checkedIn ? (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <Card accentColor={colors.caution}>
                <View style={styles.rowBetween}>
                  <Text style={[type.h2, { color: colors.textPrimary }]}>Are you okay?</Text>
                  <Badge label="Check-in" tone="caution" />
                </View>
                <Text style={[type.body, { color: colors.textMuted }]}>
                  {responsiveness.reason}. Say &quot;I&apos;m here&quot; or tap below.
                </Text>
                <View style={styles.actionsRow}>
                  <PrimaryButton
                    label="I'm here"
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setCheckedIn(true);
                    }}
                    variant="primary"
                    fullWidth={false}
                  />
                </View>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  No response escalates to a welfare check on the supervisor view — never a discipline flag.
                </Text>
              </Card>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(180).duration(400)}>
            <Card accentColor={colors[severityTone[fatigue.level]]}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Fatigue</Text>
                <Badge label={fatigue.level} tone={severityTone[fatigue.level]} />
              </View>
              <Text style={[type.body, { color: colors.textMuted }]}>{fatigue.message}</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Private to you — not visible on the supervisor view.</Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
            <Card accentColor={colors[severityTone[machineSeverity]]}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Machine health</Text>
                <Badge label={machineSeverity} tone={severityTone[machineSeverity]} />
              </View>
              {machineFlags.length ? (
                machineFlags.map((flag) => (
                  <View key={flag.reason} style={styles.rowBetween}>
                    <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>{flag.reason}</Text>
                    <Badge label={flag.severity} tone={severityTone[flag.severity]} />
                  </View>
                ))
              ) : (
                <Text style={[type.body, { color: colors.textMuted }]}>All systems normal.</Text>
              )}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <Card accentColor={colors[severityTone[slope.level]]}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Slope stability</Text>
                <Badge label={slope.level} tone={severityTone[slope.level]} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[type.body, { color: colors.textMuted }]}>Current grade</Text>
                <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>28%</Text>
              </View>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Safe up to {slope.safeLimitPct}% on current ground conditions (tightened for wet soil) — ISO 3471 ROPS-informed margin.
              </Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Card>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Working conditions</Text>
              <View style={styles.conditionsGrid}>
                <Condition label="Heat index" value="34°C" colors={colors} />
                <Condition label="Wind" value="18 km/h" colors={colors} />
                <Condition label="Visibility" value="2.1 km" colors={colors} />
                <Condition label="On shift" value="3h 40m" colors={colors} />
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(340).duration(400)}>
            <Card accentColor={colors.info}>
              <Text style={[type.h2, { color: colors.textPrimary }]}>{idlePrompt.headline}</Text>
              <Text style={[type.body, { color: colors.textMuted }]}>{idlePrompt.body}</Text>
              {idleTagged ? (
                <Text style={[type.bodyStrong, { color: colors.safe }]}>{idleConfirmationCopy(idleTagged)}</Text>
              ) : (
                <View style={styles.idleOptionsRow}>
                  {IDLE_REASON_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setIdleTagged(opt.value);
                      }}
                      style={[styles.idleChip, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                    >
                      <Text style={[type.caption, { color: colors.textPrimary }]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(380).duration(400)}>
            <Card accentColor={colors.caution}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Near-miss detected</Text>
                <Badge label="Draft" tone="caution" />
              </View>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Auto-logged: red-zone entry during swing. Confirm to save, or dismiss if this was a
                false read.
              </Text>
              <View style={styles.actionsRow}>
                <PrimaryButton label="Confirm" onPress={() => {}} variant="primary" fullWidth={false} />
                <PrimaryButton label="Dismiss" onPress={() => {}} variant="secondary" fullWidth={false} />
              </View>
            </Card>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Condition({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.conditionCell}>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{value}</Text>
    </View>
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
  alertCard: {
    gap: spacing.sm,
  },
  alertHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  radarWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conditionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  conditionCell: {
    minWidth: "40%",
    gap: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  idleOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  idleChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
});
