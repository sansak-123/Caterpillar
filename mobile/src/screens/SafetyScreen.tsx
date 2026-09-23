import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { color, spacing, type } from "../theme/tokens";

const RADAR_SIZE = 280;
const CENTER = RADAR_SIZE / 2;

// Mock state reproducing the seed 10:00 scenario: seatbelt unfastened, worker approaching
// through the rear blind spot while swinging — this is what lib/safety (Phase 5) will compute
// on-device from real telemetry.
const mockWorker = { angleDeg: 150, distanceRatio: 0.55 };

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function RadarView() {
  const worker = polarToXY(mockWorker.angleDeg, mockWorker.distanceRatio * (CENTER - 20));
  // Rear blind-spot sector, ISO 5006-informed: wedge centred behind the machine.
  const blindSpotStart = polarToXY(120, CENTER - 4);
  const blindSpotEnd = polarToXY(240, CENTER - 4);

  return (
    <View style={styles.radarWrap}>
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        <Circle cx={CENTER} cy={CENTER} r={CENTER - 4} fill={`${color.safe}14`} stroke={color.safe} strokeWidth={1.5} />
        <Circle cx={CENTER} cy={CENTER} r={(CENTER - 4) * 0.66} fill={`${color.caution}1A`} stroke={color.caution} strokeWidth={1.5} />
        <Circle cx={CENTER} cy={CENTER} r={(CENTER - 4) * 0.33} fill={`${color.danger}22`} stroke={color.danger} strokeWidth={1.5} />

        {/* rear blind-spot wedge */}
        <Polygon
          points={`${CENTER},${CENTER} ${blindSpotStart.x},${blindSpotStart.y} ${blindSpotEnd.x},${blindSpotEnd.y}`}
          fill="rgba(255,255,255,0.06)"
        />

        {/* machine body, boom pointing "forward" (up) */}
        <Path
          d={`M ${CENTER - 14} ${CENTER + 16} L ${CENTER + 14} ${CENTER + 16} L ${CENTER + 10} ${CENTER - 10} L ${CENTER - 10} ${CENTER - 10} Z`}
          fill={color.textSecondary}
        />
        <Path d={`M ${CENTER} ${CENTER - 10} L ${CENTER} ${CENTER - 46}`} stroke={color.accent} strokeWidth={4} strokeLinecap="round" />

        {/* worker breaching the red zone from the rear */}
        <Circle cx={worker.x} cy={worker.y} r={7} fill={color.danger} />
        <Circle cx={worker.x} cy={worker.y} r={12} fill="none" stroke={color.danger} strokeWidth={2} opacity={0.6} />
      </Svg>
    </View>
  );
}

export function SafetyScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.label}>SAFETY</Text>
        <Text style={[type.display, styles.title]}>Live proximity</Text>

        <Card style={styles.alertCard} accentColor={color.danger}>
          <View style={styles.alertHeaderRow}>
            <Badge label="RED ZONE" tone="danger" />
            <Text style={[type.caption, styles.muted]}>Rear sector · swing in progress</Text>
          </View>
          <Text style={[type.h2, styles.title]}>Worker in blind spot while swinging</Text>
          <Text style={[type.body, styles.muted]}>
            Zone radius widened for current visibility (2.1 km) and wind (18 km/h).
          </Text>
        </Card>

        <RadarView />

        <View style={styles.legendRow}>
          <Badge label="Green" tone="safe" />
          <Badge label="Amber" tone="caution" />
          <Badge label="Red · rear-weighted" tone="danger" />
        </View>

        <Card>
          <Text style={type.h2}>Seatbelt</Text>
          <View style={styles.rowBetween}>
            <Text style={[type.body, styles.muted]}>Status</Text>
            <Badge label="Unfastened" tone="danger" />
          </View>
          <View style={styles.rowBetween}>
            <Text style={[type.body, styles.muted]}>Engine / travel</Text>
            <Text style={[type.bodyStrong, styles.title]}>On · traveling</Text>
          </View>
        </Card>

        <Card>
          <Text style={type.h2}>Working conditions</Text>
          <View style={styles.conditionsGrid}>
            <Condition label="Heat index" value="34°C" />
            <Condition label="Wind" value="18 km/h" />
            <Condition label="Visibility" value="2.1 km" />
            <Condition label="On shift" value="3h 40m" />
          </View>
        </Card>

        <Card accentColor={color.caution}>
          <View style={styles.rowBetween}>
            <Text style={type.h2}>Near-miss detected</Text>
            <Badge label="Draft" tone="caution" />
          </View>
          <Text style={[type.body, styles.muted]}>
            Auto-logged: red-zone entry during swing. Confirm to save, or dismiss if this was a
            false read.
          </Text>
          <View style={styles.actionsRow}>
            <PrimaryButton label="Confirm" onPress={() => {}} variant="primary" fullWidth={false} />
            <PrimaryButton label="Dismiss" onPress={() => {}} variant="secondary" fullWidth={false} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Condition({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.conditionCell}>
      <Text style={[type.caption, styles.muted]}>{label}</Text>
      <Text style={[type.bodyStrong, styles.title]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    color: color.textPrimary,
  },
  muted: {
    color: color.textMuted,
  },
  alertCard: {
    gap: spacing.xs,
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
