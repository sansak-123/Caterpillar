import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { useColors } from "../theme/useColors";
import { spacing, type } from "../theme/tokens";

const RADAR_SIZE = 260;
const CENTER = RADAR_SIZE / 2;

// Mock state reproducing the seed 10:00 scenario: seatbelt unfastened, worker approaching
// through the rear blind spot while swinging — this is what lib/safety (Phase 5) will compute
// on-device from real telemetry.
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

export function SafetyScreen() {
  const colors = useColors();

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

          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
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

          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
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
});
