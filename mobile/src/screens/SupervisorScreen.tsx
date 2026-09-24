import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { HazardIcon, PulseIcon, RadioIcon } from "../components/icons";
import { CardHeader, Columns, Grid, IconTile, Page } from "../components/Page";
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
import { radius, spacing, type } from "../theme/tokens";

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
    <Page
      eyebrow="Supervisor · Site overview"
      title="Fleet overview"
      subtitle="Site-level patterns only — an individual operator's own record stays private unless they confirmed it themself (§2.1 Rule 2)."
      status={error ? { label: "Backend offline", tone: "danger" } : overview ? { label: "Live data", tone: "safe" } : { label: "Loading…", tone: "neutral" }}
      showBack
    >
      {error ? (
        <View style={[styles.banner, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}55` }]}>
          <HazardIcon color={colors.danger} size={18} />
          <Text style={[type.caption, { color: colors.textPrimary, flex: 1 }]}>{error}</Text>
        </View>
      ) : null}

      {overview ? (
        <Animated.View entering={FadeInDown.duration(350)}>
          <Grid cols={3} phoneCols={1}>
            <Stat
              icon={<PulseIcon color={colors.textPrimary} size={16} />}
              label="Tasks today"
              value={String(Object.values(overview.today_task_status).reduce((a, b) => a + b, 0))}
              colors={colors}
            />
            <Stat
              icon={<HazardIcon color={overview.tasks_with_conflict > 0 ? colors.caution : colors.safe} size={16} />}
              label="Tasks flagged with a sync conflict"
              value={String(overview.tasks_with_conflict)}
              colors={colors}
              tone={overview.tasks_with_conflict > 0 ? "caution" : "safe"}
            />
            <Stat
              icon={<RadioIcon color={overview.unconfirmed_near_misses > 0 ? colors.caution : colors.safe} size={16} />}
              label="Unconfirmed near-misses fleet-wide"
              value={String(overview.unconfirmed_near_misses)}
              colors={colors}
              tone={overview.unconfirmed_near_misses > 0 ? "caution" : "safe"}
            />
          </Grid>
        </Animated.View>
      ) : null}

      <Columns
        sideWidth={380}
        main={
          incidents ? (
            <Animated.View entering={FadeInDown.delay(140).duration(350)}>
              <Card>
                <CardHeader eyebrow="Activity" title="Recent near-misses / incidents" />
                {incidents.length === 0 ? (
                  <Text style={[type.caption, { color: colors.textMuted }]}>Nothing on record.</Text>
                ) : (
                  incidents.slice(0, 8).map((incident) => (
                    <View key={incident.id} style={[styles.incidentRow, { borderTopColor: colors.border }]}>
                      <IconTile bg={incident.confirmed ? colors.safeSoft : colors.cautionSoft} size={30}>
                        <HazardIcon color={incident.confirmed ? colors.safe : colors.caution} size={14} />
                      </IconTile>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>
                          {incident.type.replace(/_/g, " ")} · {incident.severity}
                        </Text>
                        <Text style={[type.small, { color: colors.textMuted }]}>
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
          ) : null
        }
        side={
          <>
            {overview ? (
              <Animated.View entering={FadeInDown.delay(60).duration(350)}>
                <Card>
                  <CardHeader eyebrow="Today" title="Today's tasks" />
                  <View style={styles.chipRow}>
                    {Object.entries(overview.today_task_status).map(([status, count]) => (
                      <Badge key={status} label={`${status}: ${count}`} tone="neutral" />
                    ))}
                    {Object.keys(overview.today_task_status).length === 0 ? (
                      <Text style={[type.caption, { color: colors.textMuted }]}>No tasks scheduled today.</Text>
                    ) : null}
                  </View>
                </Card>
              </Animated.View>
            ) : null}

            {hotspots ? (
              <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                <Card>
                  <CardHeader eyebrow="Patterns" title="Near-miss hotspots" />
                  <View style={styles.hotspotGrid}>
                    <HotspotFact label="Total" value={String(hotspots.total_near_misses)} colors={colors} />
                    <HotspotFact label="Worst hour" value={`${hotspots.worst_hour}:00`} colors={colors} />
                    <HotspotFact label="Worst sector" value={String(hotspots.worst_sector)} colors={colors} />
                    <HotspotFact label="Worst condition" value={String(hotspots.worst_condition)} colors={colors} />
                  </View>
                  <Text style={[type.label, { color: colors.textMuted, fontSize: 10, marginTop: spacing.xs }]}>BY MACHINE</Text>
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
          </>
        }
      />
    </Page>
  );
}

function Stat({
  icon,
  label,
  value,
  colors,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  tone?: "safe" | "caution";
}) {
  return (
    <Card>
      <View style={styles.statTop}>
        <IconTile bg={tone === "caution" ? colors.cautionSoft : tone === "safe" ? colors.safeSoft : colors.surfaceRaised} size={30}>
          {icon}
        </IconTile>
        <Text style={[type.small, { color: colors.textSecondary, flex: 1 }]}>{label}</Text>
      </View>
      <Text style={[type.metric, { color: colors.textPrimary }]}>{value}</Text>
    </Card>
  );
}

function HotspotFact({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.hotspotCell}>
      <Text style={[type.small, { color: colors.textMuted, fontSize: 11 }]}>{label}</Text>
      <Text style={[type.h2, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  hotspotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.md,
  },
  hotspotCell: {
    width: "50%",
    gap: 3,
  },
  incidentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
  },
});
