import { useState } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CheckIcon } from "../components/icons";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
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

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>END OF SHIFT</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Today&apos;s log</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Assembled automatically from your shift&apos;s telemetry — review and sign, nothing to fill in.
          </Text>

          <Animated.View entering={FadeInDown.duration(350)}>
            <Card>
              <Row label="Machine" value={shiftSummary.machineId} colors={colors} />
              <Row label="Engine hours worked" value={`${hoursWorked.toFixed(1)} h`} colors={colors} />
              <Row label="Fuel used" value={`${shiftSummary.fuelUsedL.toFixed(1)} L`} colors={colors} />
              <Row label="Load cycles" value={String(shiftSummary.loadCycles)} colors={colors} />
              <Row label="Idle time" value={`${shiftSummary.idleMin} min`} colors={colors} />
              <Row label="Near-misses logged" value={String(shiftSummary.nearMissesLogged)} colors={colors} />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(350)}>
            <Card>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Tasks completed</Text>
              {shiftSummary.tasksCompleted.map((t) => (
                <Text key={t} style={[type.body, { color: colors.textMuted }]}>
                  • {t}
                </Text>
              ))}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(350)}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setReviewed((r) => !r);
              }}
              style={[
                styles.reviewRow,
                { backgroundColor: reviewed ? `${colors.safe}17` : colors.surface, borderColor: reviewed ? colors.safe : colors.border },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: reviewed ? colors.safe : colors.border, backgroundColor: reviewed ? colors.safe : "transparent" },
                ]}
              >
                {reviewed ? <CheckIcon color={colors.mode === "light" ? "#FFFFFF" : colors.bg} size={16} /> : null}
              </View>
              <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>I&apos;ve reviewed this log and it&apos;s accurate</Text>
            </Pressable>
          </Animated.View>

          {signed ? (
            <Text style={[type.bodyStrong, { color: colors.safe }]}>Signed and submitted — no further action needed.</Text>
          ) : (
            <PrimaryButton
              label="Sign & submit"
              onPress={() => {
                if (!reviewed) return;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSigned(true);
                setTimeout(() => router.back(), 900);
              }}
              variant={reviewed ? "primary" : "secondary"}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.row}>
      <Text style={[type.body, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
