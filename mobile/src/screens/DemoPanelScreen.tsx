import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ArrowRightIcon } from "../components/icons";
import { CardHeader, Columns, Page } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
import { useConnectivityStore } from "../store/connectivity";
import { DEMO_BEAT_LABEL, DEMO_BEAT_ORDER, useDemoStore } from "../store/demo";
import { useColors } from "../theme/useColors";
import { radius, spacing, touchTarget, type } from "../theme/tokens";

// CLAUDE.md section 3.1: "a persistent connectivity pill ... and a demo 'Cut network'
// toggle in a dev-only screen." This is that screen — not part of the operator-facing
// tab bar. The narrative beats below mirror CLAUDE.md section 2's demo arc; only the
// network-cut mechanic, the jump-to-beat buttons, and the Supervisor View link are
// actually wired end-to-end today — the rest still needs Phase 7 (Unity) to exist.
const NARRATIVE_BEATS = [
  "10:00 seatbelt off + idle spike",
  "Idle Intent prompt shown (protective framing)",
  "Worker enters rear blind spot during swing → red alert",
  "Near-miss draft auto-logged",
  "Cut network (this screen) — app keeps working",
  "Network restored — data syncs",
  "Near-miss assigned as a training replay",
  "Trainee runs Ghost Operator, skill factor updates",
  "Tomorrow's estimate for that operator tightens",
];

export function DemoPanelScreen() {
  const colors = useColors();
  const devNetworkCut = useConnectivityStore((s) => s.devNetworkCut);
  const toggleDevNetworkCut = useConnectivityStore((s) => s.toggleDevNetworkCut);
  const status = useConnectivityStore((s) => s.status);
  const activeBeat = useDemoStore((s) => s.beat);
  const setBeat = useDemoStore((s) => s.setBeat);

  return (
    <Page
      eyebrow="Dev only"
      title="Demo panel"
      subtitle="Not part of the operator-facing app — a presenter control for rehearsing the offline narrative arc."
      status={{ label: status, tone: status === "online" ? "safe" : status === "offline" ? "danger" : "caution" }}
      showBack
    >
      <Columns
        sideWidth={380}
        main={
          <>
            <Card accentColor={devNetworkCut ? colors.danger : colors.safe}>
              <CardHeader
                eyebrow="Connectivity"
                title="Cut network"
                right={
                  <Switch
                    testID="demo-cut-network-switch"
                    value={devNetworkCut}
                    trackColor={{ false: colors.surfaceRaised, true: colors.danger }}
                    onValueChange={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      toggleDevNetworkCut();
                    }}
                  />
                }
              />
              <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                Forces the sync engine offline even though the backend is reachable — proves the app keeps working without a
                connection, the same as physically enabling airplane mode.
              </Text>
              <View style={styles.rowBetween}>
                <Text style={[type.small, { color: colors.textMuted }]}>Current status</Text>
                <Badge label={status} tone={status === "online" ? "safe" : status === "offline" ? "danger" : "caution"} />
              </View>
            </Card>

            <Card>
              <CardHeader eyebrow="Live safety" title="Jump to beat" />
              <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                Drives the same live proximity math the Safety tab shows — switch tabs after tapping a beat to see it react in
                real time (real lib/safety zones, seatbelt alert level, and near-miss trigger, not a canned screenshot).
              </Text>
              <View style={styles.beatButtons}>
                {DEMO_BEAT_ORDER.map((b, i) => (
                  <Pressable
                    key={b}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setBeat(b);
                    }}
                    style={[
                      styles.beatButton,
                      {
                        backgroundColor: b === activeBeat ? colors.accent : colors.surface,
                        borderColor: b === activeBeat ? colors.accentPressed : colors.borderStrong,
                      },
                    ]}
                  >
                    <Text style={[type.label, { color: b === activeBeat ? colors.accentOn : colors.textMuted, fontSize: 9.5 }]}>
                      BEAT {i + 1}
                    </Text>
                    <Text
                      style={[type.caption, { color: b === activeBeat ? colors.accentOn : colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}
                      numberOfLines={2}
                    >
                      {DEMO_BEAT_LABEL[b]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <PrimaryButton
              label="Open Supervisor View"
              onPress={() => router.push("/supervisor")}
              variant="secondary"
              fullWidth={false}
              iconRight
            icon={<ArrowRightIcon color={colors.textPrimary} size={14} />}
            />
          </>
        }
        side={
          <Card>
            <CardHeader eyebrow="Script" title="Narrative script" />
            <View style={styles.beatsList}>
              {NARRATIVE_BEATS.map((beat, i) => (
                <View key={beat} style={styles.beatRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.surfaceRaised }]}>
                    <Text style={[type.small, { color: colors.textSecondary, fontFamily: "Inter_700Bold", fontSize: 11 }]}>{i + 1}</Text>
                  </View>
                  <Text style={[type.small, { color: colors.textPrimary, flex: 1, lineHeight: 18 }]}>{beat}</Text>
                </View>
              ))}
            </View>
          </Card>
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  beatsList: {
    gap: spacing.sm + 2,
  },
  beatRow: {
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
  },
  beatButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  beatButton: {
    minWidth: "30%",
    minHeight: touchTarget,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm,
  },
});
