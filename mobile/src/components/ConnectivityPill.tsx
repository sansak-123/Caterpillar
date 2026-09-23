import { StyleSheet, Text, View } from "react-native";

import { useConnectivityStore } from "../store/connectivity";
import { color, radius, shadow, spacing, type } from "../theme/tokens";

const labelFor = {
  online: "Online",
  offline: "Offline",
  syncing: "Syncing",
} as const;

const dotColorFor = {
  online: color.online,
  offline: color.offline,
  syncing: color.syncing,
} as const;

const glowFor = {
  online: color.safeGlow,
  offline: color.dangerGlow,
  syncing: color.cautionGlow,
} as const;

export function ConnectivityPill() {
  const status = useConnectivityStore((s) => s.status);
  const queuedCount = useConnectivityStore((s) => s.queuedCount);

  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: dotColorFor[status] }, shadow.glow(glowFor[status])]} />
      <Text style={[type.caption, styles.text]}>
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
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    color: color.textSecondary,
  },
});
