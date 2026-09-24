import { useState } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DEMO_MACHINE_MODEL } from "../components/AppShell";
import { Card } from "../components/Card";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClipboardIcon, ShieldIcon } from "../components/icons";
import { CardHeader, IconTile, Page } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
import { PRE_START_CHECKLIST, type ChecklistItem } from "../content/preStartChecklist";
import { useChecklistStore } from "../store/checklist";
import { useIsWide } from "../theme/useLayout";
import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";

// Presentation-only grouping of the walkaround into the three steps an operator
// physically moves through. Any item not listed here falls into the last step, so a
// new checklist item can never silently disappear from the screen.
const STEPS: { title: string; ids: string[] }[] = [
  { title: "Walkaround", ids: ["perimeter", "tracks", "attachment", "fluids"] },
  { title: "Cab & controls", ids: ["lights_alarms", "seatbelt_rops"] },
  { title: "Work zone", ids: ["ppe", "work_area"] },
];

function itemsForStep(stepIndex: number): ChecklistItem[] {
  const grouped = new Set(STEPS.flatMap((s) => s.ids));
  const items = PRE_START_CHECKLIST.filter((item) => STEPS[stepIndex].ids.includes(item.id));
  if (stepIndex === STEPS.length - 1) {
    items.push(...PRE_START_CHECKLIST.filter((item) => !grouped.has(item.id)));
  }
  return items;
}

export function ChecklistScreen() {
  const colors = useColors();
  const isWide = useIsWide();
  const checkedIds = useChecklistStore((s) => s.checkedIds);
  const toggle = useChecklistStore((s) => s.toggle);
  const reset = useChecklistStore((s) => s.reset);
  const [step, setStep] = useState(0);

  const doneCount = checkedIds.size;
  const allDone = doneCount === PRE_START_CHECKLIST.length;
  const pct = Math.round((doneCount / PRE_START_CHECKLIST.length) * 100);
  const stepItems = itemsForStep(step);

  return (
    <Page
      eyebrow="Before your shift"
      title="Pre-start safety check"
      subtitle={`${DEMO_MACHINE_MODEL} · Replaces the paper walkaround — one tap per item.`}
      status={allDone ? { label: "Complete", tone: "safe" } : { label: "In progress", tone: "caution" }}
      showBack
    >
      <View style={styles.narrow}>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_700Bold" }]}>
              {doneCount} of {PRE_START_CHECKLIST.length} checks complete
            </Text>
            <Text style={[type.caption, { color: colors.caution, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: allDone ? colors.safe : colors.accent }]} />
          </View>
          <Text style={[type.small, { color: colors.textMuted }]}>
            Take your time. Any item that needs attention can be reviewed with your supervisor.
          </Text>
        </Card>

        <View style={styles.tabs}>
          {STEPS.map((s, i) => {
            const active = i === step;
            const stepDone = itemsForStep(i).every((item) => checkedIds.has(item.id));
            return (
              <Pressable
                key={s.title}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStep(i);
                }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accentPressed : colors.borderStrong,
                  },
                ]}
              >
                {stepDone ? <CheckIcon color={active ? colors.accentOn : colors.safe} size={14} /> : null}
                <Text
                  style={[type.small, { color: active ? colors.accentOn : colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}
                  numberOfLines={1}
                >
                  {isWide ? `${i + 1}. ${s.title}` : s.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <View style={styles.stepHeader}>
            <IconTile bg={colors.accentSoft} size={36}>
              <ClipboardIcon color={colors.textPrimary} size={18} />
            </IconTile>
            <View style={{ gap: 2 }}>
              <Text style={[type.label, { color: colors.textSecondary, fontSize: 10 }]}>
                STEP {step + 1} OF {STEPS.length}
              </Text>
              <Text style={[type.h1, { color: colors.textPrimary, fontSize: 20 }]}>{STEPS[step].title}</Text>
            </View>
          </View>

          <View style={styles.list}>
            {stepItems.map((item, i) => {
              const checked = checkedIds.has(item.id);
              return (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 40).duration(260)}>
                  <Pressable
                    testID={`checklist-item-${item.id}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      toggle(item.id);
                    }}
                    style={({ hovered }) => [
                      styles.row,
                      {
                        backgroundColor: checked ? colors.safeSoft : hovered ? colors.surfaceSunken : colors.surface,
                        borderColor: checked ? `${colors.safe}66` : colors.borderStrong,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: checked ? colors.safe : colors.borderStrong, backgroundColor: checked ? colors.safe : "transparent" },
                      ]}
                    >
                      {checked ? <CheckIcon color="#FFFFFF" size={14} /> : null}
                    </View>
                    <Text style={[type.caption, { color: colors.textPrimary, flex: 1, fontFamily: "Inter_600SemiBold" }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.stepNav}>
            <Pressable
              disabled={step === 0}
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={[styles.navButton, { borderColor: colors.border, opacity: step === 0 ? 0.45 : 1 }]}
            >
              <ArrowLeftIcon color={colors.textSecondary} size={14} />
              <Text style={[type.small, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>Previous</Text>
            </Pressable>
            {step < STEPS.length - 1 ? (
              <Pressable
                onPress={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                style={[styles.navButton, { backgroundColor: colors.accent, borderColor: colors.accentPressed }]}
              >
                <Text style={[type.small, { color: colors.accentOn, fontFamily: "Inter_700Bold" }]}>Next step</Text>
                <ArrowRightIcon color={colors.accentOn} size={14} />
              </Pressable>
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={styles.stepHeader}>
            <ShieldIcon color={colors.textPrimary} size={17} />
            <CardHeader title="Operator confirmation" />
          </View>
          <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
            I have checked the items above and raised anything requiring attention.
          </Text>
          <PrimaryButton
            testID="checklist-start-shift"
            label={allDone ? "Start shift" : `Complete ${PRE_START_CHECKLIST.length - doneCount} more to start`}
            onPress={() => {
              if (!allDone) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }}
            variant={allDone ? "primary" : "accent"}
          />
          {doneCount > 0 ? (
            <PrimaryButton testID="checklist-reset" label="Reset" onPress={reset} variant="secondary" fullWidth={false} />
          ) : null}
        </Card>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  narrow: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  list: {
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md - 2,
    minHeight: 38,
  },
});
