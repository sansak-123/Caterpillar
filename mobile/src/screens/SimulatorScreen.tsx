import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ScreenBackground } from "../components/ScreenBackground";
import UnitySim from "../components/UnitySim";
import {
  SEED_TELEMETRY_ROWS,
  SimCommands,
  type GhostScore,
  type SimMessage,
  type SimStatus,
  type UnitySimHandle,
} from "../lib/unity/bridge";
import { useTrainingProgressStore } from "../store/trainingProgress";
import { useColors } from "../theme/useColors";
import { spacing, radius, type } from "../theme/tokens";

type LogItem = { id: string; text: string; kind: "incident" | "ghost" };

// Only Ghost Operator (training mode replaying an expert trace) and a raw telemetry
// replay actually exist in the Unity bridge today (lib/unity/bridge.ts's SimCommands)
// — "Near-Miss Replay"/"Idle Discipline"/"Loading in Rain" are scenario IDs the
// Training tab's UI offers, but nothing on the Unity side branches on them yet. Rather
// than silently launching the same generic scene for all four and letting the operator
// think they ran a different scenario than they actually got, this screen says so.
const SUPPORTED_SCENARIOS = new Set(["GhostOperator"]);

export function SimulatorScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ scenario?: string }>();
  const scenario = params.scenario ?? "GhostOperator";
  const recordSession = useTrainingProgressStore((s) => s.recordSession);

  const sim = useRef<UnitySimHandle>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [lastScore, setLastScore] = useState<GhostScore | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);

  const onMessage = useCallback(
    (m: SimMessage) => {
      switch (m.type) {
        case "ready":
          setReady(true);
          if (SUPPORTED_SCENARIOS.has(scenario)) sim.current?.send(SimCommands.setMode("training"));
          break;
        case "status":
          setStatus(m.data);
          break;
        case "event":
          if (m.data.type === "engine" || m.data.type === "ghost_start") break;
          // TODO: write to incidents table + outbox (lib/db) — training incidents, tag source: "simulator"
          setLog((l) => [{ id: `${Date.now()}`, text: m.data.message, kind: "incident" as const }, ...l].slice(0, 50));
          break;
        case "ghost_score":
          setLastScore(m.data);
          recordSession(scenario, m.data);
          setLog((l) =>
            [
              {
                id: `${Date.now()}`,
                text: `Train with Expert: skill ${m.data.skill_factor.toFixed(2)}, match ${Math.round(m.data.match_pct)}%`,
                kind: "ghost" as const,
              },
              ...l,
            ].slice(0, 50)
          );
          break;
        case "ghost_trace":
          // TODO: save as a new expert trace (tacit-knowledge capture)
          break;
      }
    },
    [scenario, recordSession]
  );

  const replaySeedDay = () => {
    sim.current?.send(SimCommands.setMode("telemetry"));
    SEED_TELEMETRY_ROWS.forEach((row, i) => setTimeout(() => sim.current?.send(SimCommands.telemetry(row)), 500 + i * 5000));
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["bottom"]}>
        {!SUPPORTED_SCENARIOS.has(scenario) ? (
          <View style={[styles.notice, { backgroundColor: `${colors.caution}17`, borderColor: colors.caution }]}>
            <Text style={[type.caption, { color: colors.textPrimary }]}>
              &quot;{scenario}&quot; isn&apos;t a distinct simulator scene yet — this launches the same Train with
              Expert trainer as a stand-in.
            </Text>
          </View>
        ) : null}

        <View style={[styles.simBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <UnitySim ref={sim} onMessage={onMessage} />
        </View>

        <View style={styles.statusRow}>
          <Badge label={ready ? "Connected" : "Loading…"} tone={ready ? "safe" : "neutral"} />
          {status ? (
            <>
              <Badge label={status.engineOn ? "Engine on" : "Engine off"} tone={status.engineOn ? "safe" : "neutral"} />
              <Badge label={status.seatbelt ? "Belt fastened" : "Belt unfastened"} tone={status.seatbelt ? "safe" : "danger"} />
            </>
          ) : null}
        </View>

        {lastScore ? (
          <Card accentColor={colors.accent}>
            <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>Last run</Text>
            <View style={styles.scoreGrid}>
              <ScoreCell label="Skill factor" value={lastScore.skill_factor.toFixed(2)} colors={colors} />
              <ScoreCell label="Match" value={`${Math.round(lastScore.match_pct)}%`} colors={colors} />
              <ScoreCell label="Cycles" value={String(lastScore.cycles)} colors={colors} />
              <ScoreCell label="Fuel/cycle" value={`${lastScore.fuel_per_cycle_l.toFixed(1)} L`} colors={colors} />
            </View>
          </Card>
        ) : null}

        <Text style={[type.label, { color: colors.textMuted, marginTop: spacing.xs }]}>ACTIVITY LOG</Text>
        <ScrollView style={styles.log} showsVerticalScrollIndicator={false}>
          {log.length === 0 ? (
            <Text style={[type.caption, { color: colors.textMuted }]}>
              Nothing yet — start operating in the viewport above.
            </Text>
          ) : (
            log.map((item) => (
              <Text
                key={item.id}
                style={[
                  type.caption,
                  styles.logItem,
                  { color: colors.textSecondary, borderLeftColor: item.kind === "ghost" ? colors.info : colors.accent },
                ]}
              >
                {item.text}
              </Text>
            ))
          )}
        </ScrollView>

        <Text
          onPress={replaySeedDay}
          style={[type.caption, { color: colors.textMuted, textDecorationLine: "underline", alignSelf: "flex-start" }]}
        >
          Dev: replay seed telemetry day
        </Text>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function ScoreCell({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.scoreCell}>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  simBox: {
    flex: 1,
    minHeight: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  scoreCell: {
    minWidth: "40%",
    gap: 2,
  },
  log: {
    maxHeight: 140,
  },
  logItem: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
});

export default SimulatorScreen;
