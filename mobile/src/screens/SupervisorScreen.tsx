import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ScreenBackground } from "../components/ScreenBackground";
import {
  ensureDemoSupervisorSession,
  fetchIncidents,
  fetchNearMissHotspots,
  fetchSupervisorOverview,
  type ApiIncident,
  type NearMissHotspots,
  type SupervisorOverview,
} from "../lib/api/client";
import { useColors } from "../theme/useColors";
import { spacing, type } from "../theme/tokens";

/**
 * Phase 6 slice — CLAUDE.md §6 "Supervisor" and §2.1 Rule 2. Real backend data
 * (`/supervisor/overview`, `/nearmiss/hotspots`, `/incidents`), already aggregated or
 * anonymized server-side rather than a per-operator scoreboard — this screen renders
 * what the API gives it, it doesn't do any additional filtering of its own. There's no
 * real login/role-switch screen yet (see README "known gaps"), so this logs in as a
 * separate demo supervisor account, the same simplification TodayScreen already makes
 * for the operator account.
 */
export function SupervisorScreen() {
  const colors = useColors();
  const [overview, setOverview] = useState<SupervisorOverview | null>(null);
  const [hotspots, setHotspots] = useState<NearMissHotspots | null>(null);
  const [incidents, setIncidents] = useState<ApiIncident[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { token } = await ensureDemoSupervisorSession();
        const [ov, hs, inc] = await Promise.all([
          fetchSupervisorOverview(token),
          fetchNearMissHotspots(token),
          fetchIncidents(token),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setHotspots(hs);
        setIncidents(inc);
      } catch {
        if (!cancelled) setError("Couldn't reach the backend — start it and reload this screen.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>SUPERVISOR</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Fleet overview</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Site-level patterns only — an individual operator&apos;s own record stays private unless
            they confirmed it themself (§2.1 Rule 2).
          </Text>

          {error ? (
            <Card accentColor={colors.danger}>
              <Text style={[type.body, { color: colors.textMuted }]}>{error}</Text>
            </Card>
          ) : null}

          {overview ? (
            <Animated.View entering={FadeInDown.duration(350)}>
              <Card>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Today&apos;s tasks</Text>
                <View style={styles.chipRow}>
                  {Object.entries(overview.today_task_status).map(([status, count]) => (
                    <Badge key={status} label={`${status}: ${count}`} tone="neutral" />
                  ))}
                  {Object.keys(overview.today_task_status).length === 0 ? (
                    <Text style={[type.body, { color: colors.textMuted }]}>No tasks scheduled today.</Text>
                  ) : null}
                </View>
                <View style={styles.rowBetween}>
                  <Text style={[type.body, { color: colors.textMuted }]}>Tasks flagged with a sync conflict</Text>
                  <Badge
                    label={String(overview.tasks_with_conflict)}
                    tone={overview.tasks_with_conflict > 0 ? "caution" : "safe"}
                  />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={[type.body, { color: colors.textMuted }]}>Unconfirmed near-misses fleet-wide</Text>
                  <Badge
                    label={String(overview.unconfirmed_near_misses)}
                    tone={overview.unconfirmed_near_misses > 0 ? "caution" : "safe"}
                  />
                </View>
              </Card>
            </Animated.View>
          ) : null}

          {hotspots ? (
            <Animated.View entering={FadeInDown.delay(80).duration(350)}>
              <Card accentColor={colors.info}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Near-miss hotspots</Text>
                <Text style={[type.body, { color: colors.textMuted }]}>
                  {hotspots.total_near_misses} total · worst hour {hotspots.worst_hour}:00 · worst sector{" "}
                  {hotspots.worst_sector} · worst condition {hotspots.worst_condition}
                </Text>
                <Text style={[type.bodyStrong, { color: colors.textPrimary, marginTop: spacing.xs }]}>By machine</Text>
                <View style={styles.chipRow}>
                  {Object.entries(hotspots.by_machine)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([machine, count]) => (
                      <Badge key={machine} label={`${machine}: ${count}`} tone="neutral" />
                    ))}
                </View>
              </Card>
            </Animated.View>
          ) : null}

          {incidents ? (
            <Animated.View entering={FadeInDown.delay(140).duration(350)}>
              <Card>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Recent near-misses / incidents</Text>
                {incidents.length === 0 ? (
                  <Text style={[type.body, { color: colors.textMuted }]}>Nothing on record.</Text>
                ) : (
                  incidents.slice(0, 8).map((incident) => (
                    <View key={incident.id} style={styles.incidentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>
                          {incident.type.replace(/_/g, " ")} · {incident.severity}
                        </Text>
                        <Text style={[type.caption, { color: colors.textMuted }]}>
                          {incident.machine_id} ·{" "}
                          {incident.operator_id ? `confirmed by ${incident.operator_id}` : "anonymized — unconfirmed"}
                        </Text>
                      </View>
                      <Badge label={incident.confirmed ? "confirmed" : "draft"} tone={incident.confirmed ? "safe" : "caution"} />
                    </View>
                  ))
                )}
              </Card>
            </Animated.View>
          ) : null}
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  incidentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
