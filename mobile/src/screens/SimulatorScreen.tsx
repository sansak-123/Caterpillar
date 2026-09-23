import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { UnitySim, type UnitySimHandle } from "../components/UnitySim";
import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";

/**
 * Full-screen Ghost Operator / scenario runner — CLAUDE.md Phase 7. Wires the real
 * ScenarioManager message contract (LoadScenario / EndScenario) through UnitySim; see
 * that component's doc comment for why only the WebGL-fallback tier has a real
 * implementation today.
 */
export function SimulatorScreen() {
  const colors = useColors();
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  const scenarioName = scenario ?? "GhostOperator";
  const simRef = useRef<UnitySimHandle>(null);
  // A freshly-loaded scenario is running by definition — set as the initial value
  // rather than inside the effect below, which only needs to talk to UnitySim.
  const [running, setRunning] = useState(true);
  const [lastScore, setLastScore] = useState<Record<string, unknown> | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    simRef.current?.send({
      method: "LoadScenario",
      arg: {
        scenario: scenarioName,
        machineClass: "excavator",
        conditions: { visibilityM: 10000, precipMm: 0, windKmh: 5 },
      },
    });
  }, [scenarioName]);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.header}>
          <Text style={[type.label, { color: colors.textMuted }]}>SCENARIO</Text>
          <Text style={[type.h1, { color: colors.textPrimary }]}>{scenarioName}</Text>
        </View>

        <View style={[styles.viewport, { borderColor: colors.border }]}>
          <UnitySim
            ref={simRef}
            onScore={(result) => {
              setRunning(false);
              setLastScore(result as Record<string, unknown>);
            }}
            onError={(message) => setSimError(message)}
          />
        </View>

        {simError ? (
          <Text style={[type.caption, { color: colors.danger }]}>{simError}</Text>
        ) : null}

        {lastScore ? (
          <View style={[styles.scoreBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[type.h2, { color: colors.textPrimary }]}>Score</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>{JSON.stringify(lastScore)}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {running ? (
            <PrimaryButton
              label="End scenario"
              onPress={() => simRef.current?.send({ method: "EndScenario" })}
              variant="primary"
            />
          ) : (
            <PrimaryButton label="Back to Training" onPress={() => router.back()} variant="secondary" />
          )}
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    gap: 2,
  },
  viewport: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  scoreBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
});
