import { StyleSheet, Text, View } from "react-native";

import { useConnectivityStore } from "../store/connectivity";
import { useColors } from "../theme/useColors";
import { radius, spacing } from "../theme/tokens";
import { WifiIcon } from "./icons";

const labelFor = {
  online: "Online",
  offline: "Offline",
  syncing: "Syncing",
} as const;

export function ConnectivityPill() {
  const colors = useColors();
  const status = useConnectivityStore((s) => s.status);
  const queuedCount = useConnectivityStore((s) => s.queuedCount);

  const fgFor = { online: colors.online, offline: colors.offline, syncing: colors.syncing } as const;
  const bgFor = { online: colors.safeSoft, offline: colors.dangerSoft, syncing: colors.cautionSoft } as const;

  return (
    <View testID="connectivity-pill" style={[styles.pill, { backgroundColor: bgFor[status] }]}>
      <WifiIcon color={fgFor[status]} size={14} off={status === "offline"} />
      <Text testID="connectivity-pill-label" style={[styles.text, { color: fgFor[status] }]}>
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
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
