import * as Haptics from "expo-haptics";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ScreenBackground } from "../components/ScreenBackground";
import { useConnectivityStore } from "../store/connectivity";
import { useColors } from "../theme/useColors";
import { spacing, type } from "../theme/tokens";

// CLAUDE.md section 3.1: "a persistent connectivity pill ... and a demo 'Cut network'
// toggle in a dev-only screen." This is that screen — not part of the operator-facing
// tab bar. The narrative beats below mirror CLAUDE.md section 2's demo arc; only the
// network-cut mechanic is actually wired end-to-end today (real fetch vs. real fallback
// — see TodayScreen), the rest describes what a full run-through demonstrates once
// Phase 6 (supervisor view) and Phase 7 (Unity) exist.
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

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>DEV ONLY</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Demo panel</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Not part of the operator-facing app — a presenter control for rehearsing the offline
            narrative arc.
          </Text>

          <Card accentColor={devNetworkCut ? colors.danger : colors.safe}>
            <View style={styles.rowBetween}>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Cut network</Text>
              <Switch
                value={devNetworkCut}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleDevNetworkCut();
                }}
              />
            </View>
            <Text style={[type.body, { color: colors.textMuted }]}>
              Forces the sync engine offline even though the backend is reachable — proves the app
              keeps working without a connection, the same as physically enabling airplane mode.
            </Text>
            <View style={styles.rowBetween}>
              <Text style={[type.body, { color: colors.textMuted }]}>Current status</Text>
              <Badge label={status} tone={status === "online" ? "safe" : status === "offline" ? "danger" : "caution"} />
            </View>
          </Card>

          <Text style={[type.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>Narrative script</Text>
          <View style={styles.beatsList}>
            {NARRATIVE_BEATS.map((beat, i) => (
              <View key={beat} style={styles.beatRow}>
                <Text style={[type.caption, { color: colors.textMuted }]}>{i + 1}</Text>
                <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>{beat}</Text>
              </View>
            ))}
          </View>
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  beatsList: {
    gap: spacing.sm,
  },
  beatRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
});
