import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CheckIcon } from "../components/icons";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { PRE_START_CHECKLIST } from "../content/preStartChecklist";
import { useChecklistStore } from "../store/checklist";
import { useColors } from "../theme/useColors";
import { radius, spacing, touchTarget, type } from "../theme/tokens";

export function ChecklistScreen() {
  const colors = useColors();
  const checkedIds = useChecklistStore((s) => s.checkedIds);
  const toggle = useChecklistStore((s) => s.toggle);
  const reset = useChecklistStore((s) => s.reset);

  const doneCount = checkedIds.size;
  const allDone = doneCount === PRE_START_CHECKLIST.length;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>PRE-START</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Walkaround checklist</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Replaces the paper walkaround — one tap per item. {doneCount}/{PRE_START_CHECKLIST.length} complete.
          </Text>

          <View style={styles.list}>
            {PRE_START_CHECKLIST.map((item, i) => {
              const checked = checkedIds.has(item.id);
              return (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      toggle(item.id);
                    }}
                    style={[
                      styles.row,
                      {
                        backgroundColor: checked ? `${colors.safe}17` : colors.surface,
                        borderColor: checked ? colors.safe : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: checked ? colors.safe : colors.border, backgroundColor: checked ? colors.safe : "transparent" },
                      ]}
                    >
                      {checked ? <CheckIcon color={colors.mode === "light" ? "#FFFFFF" : colors.bg} size={18} /> : null}
                    </View>
                    <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>{item.label}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <PrimaryButton
            label={allDone ? "Start shift" : `Complete ${PRE_START_CHECKLIST.length - doneCount} more to start`}
            onPress={() => {
              if (!allDone) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }}
            variant={allDone ? "primary" : "secondary"}
          />
          {doneCount > 0 ? (
            <PrimaryButton label="Reset" onPress={reset} variant="secondary" fullWidth={false} />
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
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
