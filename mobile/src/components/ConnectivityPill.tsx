import { StyleSheet, Text, View } from "react-native";

import { useConnectivityStore } from "../store/connectivity";
import { useColors } from "../theme/useColors";
import { radius, shadow, spacing, type } from "../theme/tokens";

const labelFor = {
  online: "Online",
  offline: "Offline",
  syncing: "Syncing",
} as const;

export function ConnectivityPill() {
  const colors = useColors();
  const status = useConnectivityStore((s) => s.status);
  const queuedCount = useConnectivityStore((s) => s.queuedCount);

  const dotColorFor = { online: colors.online, offline: colors.offline, syncing: colors.syncing } as const;
  const glowFor = { online: colors.safeGlow, offline: colors.dangerGlow, syncing: colors.cautionGlow } as const;

  return (
    <View testID="connectivity-pill" style={[styles.pill, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: dotColorFor[status] }, shadow.glow(glowFor[status])]} />
      <Text testID="connectivity-pill-label" style={[type.caption, { color: colors.textSecondary }]}>
        {labelFor[status]}
        {queuedCount > 0 ? ` · ${queuedCount} queued` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
