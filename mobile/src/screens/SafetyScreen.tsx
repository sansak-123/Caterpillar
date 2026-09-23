import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { useVoiceInput } from "../lib/assistant/voice";
import { DEMO_MACHINE_ID } from "../lib/api/client";
import { appendToOutbox } from "../lib/sync/outbox";
import { useAuthStore } from "../store/auth";
import { DEMO_BEAT_LABEL, useDemoStore, type DemoBeat } from "../store/demo";
import {
  fatigueAlert,
  machineHealthAlert,
  worstSeverity,
  slopeAlert,
  responsivenessCheck,
  idlePromptCopy,
  idleConfirmationCopy,
  IDLE_REASON_OPTIONS,
  type IdleReason,
  seatbeltAlert,
  proximityZones,
  zoneForDistance,
  nearMissTrigger,
  acceptsConfirmation,
  shouldFireLoudAlert,
  type Zone,
} from "../lib/safety";
import { useColors } from "../theme/useColors";
import { spacing, type } from "../theme/tokens";

const RADAR_SIZE = 260;
const CENTER = RADAR_SIZE / 2;
const DISPLAY_RADIUS = CENTER - 20;

// Demo conditions reproducing CLAUDE.md's seed-anchored narrative in fixed visibility/
// wind. The active `beat` (shared with the Demo Panel via useDemoStore, so a presenter
// can drive this screen remotely) only changes swing state, seatbelt state, and the
// worker's fixed distance — everything else (zone radii, seatbelt alert level,
// near-miss trigger) is the REAL lib/safety math reacting to those inputs, exactly as
// it would from live telemetry (USP-4: condition-adaptive envelope; Rule 1: input
// lockout while moving).
const CONDITIONS = { visibilityM: 2100, precipMm: 0, windKmh: 18 };

type BeatConfig = { isSwinging: boolean; seatbeltUnfastened: boolean; workerDistanceM: number };

const BEAT_CONFIG: Record<DemoBeat, BeatConfig> = {
  normal: { isSwinging: false, seatbeltUnfastened: false, workerDistanceM: 25 },
  seatbelt_idle: { isSwinging: false, seatbeltUnfastened: true, workerDistanceM: 25 },
  approaching: { isSwinging: true, seatbeltUnfastened: false, workerDistanceM: 15 },
  red_alert: { isSwinging: true, seatbeltUnfastened: false, workerDistanceM: 10 },
  recovery: { isSwinging: false, seatbeltUnfastened: false, workerDistanceM: 20 },
};

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

const zoneColor = (colors: ReturnType<typeof useColors>, zone: Zone) =>
  zone === "red" ? colors.danger : zone === "amber" ? colors.caution : colors.safe;

function RadarView({
  colors,
  redM,
  amberM,
  workerDistanceM,
  workerZone,
}: {
  colors: ReturnType<typeof useColors>;
  redM: number;
  amberM: number;
  workerDistanceM: number;
  workerZone: Zone;
}) {
  // Fixed real-world reference (30 m) mapped to the display radius, so the amber/red
  // rings occupy a genuine fraction of the widget — leaving real green space outside
  // amber — and their SIZE moves with real conditions/swing state, not just a cosmetic
  // fraction like before.
  const MAX_DISPLAY_METERS = 30;
  const metersToPx = DISPLAY_RADIUS / MAX_DISPLAY_METERS;
  const amberPx = Math.min(amberM * metersToPx, DISPLAY_RADIUS);
  const redPx = Math.min(redM * metersToPx, DISPLAY_RADIUS);
  const workerPx = Math.min(workerDistanceM * metersToPx, DISPLAY_RADIUS);

  const worker = polarToXY(180, workerPx); // rear sector, straight behind the machine
  const blindSpotStart = polarToXY(120, CENTER - 4);
  const blindSpotEnd = polarToXY(240, CENTER - 4);
  const machineFill = colors.mode === "light" ? "#4B4F58" : colors.textSecondary;
  const wedgeFill = colors.mode === "light" ? "rgba(20,20,20,0.05)" : "rgba(255,255,255,0.05)";
  const dotColor = zoneColor(colors, workerZone);

  return (
    <View style={styles.radarWrap}>
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        <Circle cx={CENTER} cy={CENTER} r={DISPLAY_RADIUS} fill={`${colors.safe}14`} stroke={colors.safe} strokeWidth={1.5} />
        <Circle cx={CENTER} cy={CENTER} r={amberPx} fill={`${colors.caution}1A`} stroke={colors.caution} strokeWidth={1.5} />
        <Circle cx={CENTER} cy={CENTER} r={redPx} fill={`${colors.danger}22`} stroke={colors.danger} strokeWidth={1.5} />

        <Polygon
          points={`${CENTER},${CENTER} ${blindSpotStart.x},${blindSpotStart.y} ${blindSpotEnd.x},${blindSpotEnd.y}`}
          fill={wedgeFill}
        />

        <Path
          d={`M ${CENTER - 14} ${CENTER + 16} L ${CENTER + 14} ${CENTER + 16} L ${CENTER + 10} ${CENTER - 10} L ${CENTER - 10} ${CENTER - 10} Z`}
          fill={machineFill}
        />
        <Path d={`M ${CENTER} ${CENTER - 10} L ${CENTER} ${CENTER - 42}`} stroke={colors.accent} strokeWidth={4} strokeLinecap="round" />

        <Circle cx={worker.x} cy={worker.y} r={7} fill={dotColor} />
        <Circle cx={worker.x} cy={worker.y} r={13} fill="none" stroke={dotColor} strokeWidth={2} opacity={0.55} />
      </Svg>
    </View>
  );
}

const severityTone: Record<"ok" | "caution" | "danger", "safe" | "caution" | "danger"> = {
  ok: "safe",
  caution: "caution",
  danger: "danger",
};

type NearMissDraft = {
  trigger: NonNullable<ReturnType<typeof nearMissTrigger>>;
  detectedAt: number;
  status: "pending" | "confirmed" | "dismissed";
};

export function SafetyScreen() {
  const colors = useColors();
  const [idleTagged, setIdleTagged] = useState<IdleReason | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [draft, setDraft] = useState<NearMissDraft | null>(null);
  const beat = useDemoStore((s) => s.beat);
  const nextBeat = useDemoStore((s) => s.nextBeat);

  const confirmVoice = useVoiceInput("en");
  const checkInVoice = useVoiceInput("en");

  // --- Real lib/safety computation, not hardcoded strings ---
  const { isSwinging, seatbeltUnfastened, workerDistanceM } = BEAT_CONFIG[beat];
  const travelKmh = 0; // swinging in place, not traveling
  const swingRateDps = isSwinging ? 8 : 0;
  const belt = seatbeltAlert(true, travelKmh, swingRateDps, seatbeltUnfastened, 12);
  const zones = proximityZones("excavator", CONDITIONS.visibilityM, CONDITIONS.precipMm, CONDITIONS.windKmh, isSwinging, false, true);
  const workerZone = zoneForDistance(workerDistanceM, zones);
  const liveMiss = nearMissTrigger(workerZone, isSwinging, false, seatbeltUnfastened, travelKmh);
  const tapAllowed = acceptsConfirmation("tap", travelKmh, swingRateDps);

  const authOperatorId = useAuthStore((s) => s.operatorId);

  // Confirming writes a real `incident_confirm` event to the on-device outbox (CLAUDE.md
  // §3.1) — this succeeds instantly regardless of connectivity (USP-2/USP-5: safety
  // never waits on the network), and useSyncEngine (mounted at the app root) drains it
  // to /sync/push whenever there's a connection. This is what makes Phase 6's
  // acceptance bar real: "a near-miss confirmed offline appears in supervisor view
  // after reconnect."
  function confirmDraft(current: NearMissDraft) {
    setDraft({ ...current, status: "confirmed" });
    if (!authOperatorId) return;
    appendToOutbox("incident_confirm", {
      incident_id: `NM${current.detectedAt.toString(36)}`,
      ts: new Date(current.detectedAt).toISOString(),
      machine_id: DEMO_MACHINE_ID,
      operator_id: authOperatorId,
      type: "struck_by",
      severity: "Near-miss",
      is_near_miss: true,
      trigger: current.trigger,
      confirmed: true,
    }).catch(() => {
      // lib/db unavailable on this platform/build — the local confirm above still holds.
    });
  }

  // Same outbox pattern for Idle Intent Tagging (USP-3) — the tag is the operator's
  // own protective record (§2.1 Rule 3), captured instantly and synced opportunistically.
  function tagIdle(reason: IdleReason) {
    setIdleTagged(reason);
    if (!authOperatorId) return;
    // Only ever invoked from the onPress handler below, never during render — the
    // compiler's purity check can't see that from a function defined in the component
    // body, same class of false positive as elsewhere in this file.
    // eslint-disable-next-line
    const now = Date.now();
    appendToOutbox("idle_tag", {
      window_id: `idle-${now.toString(36)}`,
      machine_id: DEMO_MACHINE_ID,
      operator_id: authOperatorId,
      ts_start: new Date(now - 5 * 60_000).toISOString(),
      ts_end: new Date(now).toISOString(),
      duration_min: 5,
      reason,
    }).catch(() => {
      // lib/db unavailable on this platform/build — the local tag above still holds.
    });
  }

  // A near-miss draft is captured the instant it's detected and persists for
  // confirmation even after the triggering condition clears (e.g. swing stops) — it
  // doesn't just vanish because the radar looks safe again a moment later.
  useEffect(() => {
    if (liveMiss && (!draft || draft.status !== "pending")) {
      // Capturing a draft the instant the trigger fires is the point; it must persist
      // past the triggering tick, so this genuinely needs to be an effect.
      // eslint-disable-next-line
      setDraft({ trigger: liveMiss, detectedAt: Date.now(), status: "pending" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMiss]);

  // Rule 4 — loud alerts back off exponentially instead of re-firing every render.
  const alertState = useRef<{ lastFiredAt: number | null; repeatCount: number }>({ lastFiredAt: null, repeatCount: 0 });
  useEffect(() => {
    if (workerZone !== "red") return;
    const now = Date.now();
    if (shouldFireLoudAlert(now, alertState.current.lastFiredAt, alertState.current.repeatCount)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alertState.current = { lastFiredAt: now, repeatCount: alertState.current.repeatCount + 1 };
    }
  }, [workerZone]);

  useEffect(() => {
    if (!confirmVoice.listening && confirmVoice.finalTranscript().trim() && draft && draft.status === "pending") {
      // Reacting to the STT hook's listening->false transition, which only exists as
      // an effect-observable event.
      // eslint-disable-next-line
      confirmDraft(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmVoice.listening]);

  useEffect(() => {
    if (!checkInVoice.listening && checkInVoice.finalTranscript().trim()) {
      // Same STT transition pattern as above.
      // eslint-disable-next-line
      setCheckedIn(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInVoice.listening]);

  // Representative mock inputs for the USP-6 signals not covered by the radar scenario
  // above (Phase 4's real telemetry feed will replace all of these mock call sites).
  const fatigue = fatigueAlert(0.72, 6.5);
  const machineFlags = machineHealthAlert({
    hydraulicPressureBar: 338,
    hydraulicOilTempC: 98,
    coolantTempC: 111,
    defLevelPct: 22,
    faultCodeActive: false,
    hoursSinceLastService: 540,
    serviceIntervalHrs: 500,
  });
  const machineSeverity = worstSeverity(machineFlags);
  const slope = slopeAlert(28, 45, 200);
  const responsiveness = responsivenessCheck({
    engineOn: true,
    seatbeltFastened: true,
    travelKmh: 0.05,
    swingRateDps: 0.1,
    boomDeltaDegPerMin: 0.2,
    stickDeltaDegPerMin: 0.1,
    bucketDeltaDegPerMin: 0,
    stationaryMinutes: 18,
  });
  const idlePrompt = idlePromptCopy(5);
  const idleChipsEnabled = tapAllowed;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[type.label, { color: colors.textMuted }]}>SAFETY</Text>
          <Text style={[type.display, { color: colors.textPrimary }]}>Live proximity</Text>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              nextBeat();
            }}
            style={[styles.demoToggle, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          >
            <Text style={[type.caption, { color: colors.textMuted }]}>
              DEMO beat — tap to advance: {DEMO_BEAT_LABEL[beat]} (also drivable from the Demo Panel)
            </Text>
          </Pressable>

          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard glowColor={workerZone === "red" ? colors.dangerGlow : colors.infoGlow} style={styles.alertCard}>
              <View style={styles.alertHeaderRow}>
                <Badge label={`${workerZone.toUpperCase()} ZONE`} tone={workerZone === "red" ? "danger" : workerZone === "amber" ? "caution" : "safe"} />
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  Rear sector · {isSwinging ? "swing in progress" : "stationary"}
                </Text>
              </View>
              <Text style={[type.h2, { color: colors.textPrimary }]}>
                {workerZone === "red" ? "Worker in blind spot while swinging" : "Worker in rear sector"}
              </Text>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Zone widened for visibility ({(CONDITIONS.visibilityM / 1000).toFixed(1)} km) and wind (
                {CONDITIONS.windKmh} km/h) — red {zones.redM.toFixed(1)} m, amber {zones.amberM.toFixed(1)} m. Worker
                at {workerDistanceM} m.
              </Text>

              <RadarView
                colors={colors}
                redM={zones.redM}
                amberM={zones.amberM}
                workerDistanceM={workerDistanceM}
                workerZone={workerZone}
              />

              <View style={styles.legendRow}>
                <Badge label="Green" tone="safe" />
                <Badge label="Amber" tone="caution" />
                <Badge label="Red · rear-weighted" tone="danger" />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Card accentColor={belt === "hard" ? colors.danger : belt === "soft" ? colors.caution : colors.safe}>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Seatbelt</Text>
              <View style={styles.rowBetween}>
                <Text style={[type.body, { color: colors.textMuted }]}>Status</Text>
                <Badge label={seatbeltUnfastened ? "Unfastened" : "Fastened"} tone={seatbeltUnfastened ? "danger" : "safe"} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[type.body, { color: colors.textMuted }]}>Engine / motion</Text>
                <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>On · {isSwinging ? "swinging" : "idle"}</Text>
              </View>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {belt === "hard"
                  ? "Loud alert — unfastened while moving/swinging past 5s."
                  : belt === "soft"
                    ? "Quiet reminder — unfastened while stationary."
                    : "No alert."}
              </Text>
            </Card>
          </Animated.View>

          {draft && draft.status === "pending" ? (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <Card accentColor={colors.caution}>
                <View style={styles.rowBetween}>
                  <Text style={[type.h2, { color: colors.textPrimary }]}>Near-miss detected</Text>
                  <Badge label="Draft" tone="caution" />
                </View>
                <Text style={[type.body, { color: colors.textMuted }]}>
                  Auto-logged: {draft.trigger.replace(/_/g, " ")}. Confirm to save, or dismiss if this was a false
                  read.
                </Text>
                {tapAllowed ? (
                  <View style={styles.actionsRow}>
                    <PrimaryButton
                      label="Confirm"
                      onPress={() => confirmDraft(draft)}
                      variant="primary"
                      fullWidth={false}
                    />
                    <PrimaryButton
                      label="Dismiss"
                      onPress={() => setDraft((d) => (d ? { ...d, status: "dismissed" } : d))}
                      variant="secondary"
                      fullWidth={false}
                    />
                  </View>
                ) : (
                  <Text style={[type.caption, { color: colors.caution }]}>
                    Machine is moving — tap confirm/dismiss is locked (Rule 1). It&apos;ll surface again the moment
                    you stop, or confirm right now by voice.
                  </Text>
                )}
                <View style={styles.actionsRow}>
                  <PrimaryButton
                    label={confirmVoice.listening ? "Listening…" : "Confirm by voice"}
                    onPress={() => (confirmVoice.listening ? confirmVoice.stop() : confirmVoice.start())}
                    variant="accent"
                    fullWidth={false}
                  />
                </View>
              </Card>
            </Animated.View>
          ) : draft ? (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>Near-miss {draft.status}</Text>
                  <Badge label={draft.status} tone={draft.status === "confirmed" ? "safe" : "neutral"} />
                </View>
              </Card>
            </Animated.View>
          ) : null}

          {responsiveness.shouldCheckIn && !checkedIn ? (
            <Animated.View entering={FadeInDown.delay(170).duration(400)}>
              <Card accentColor={colors.caution}>
                <View style={styles.rowBetween}>
                  <Text style={[type.h2, { color: colors.textPrimary }]}>Are you okay?</Text>
                  <Badge label="Check-in" tone="caution" />
                </View>
                <Text style={[type.body, { color: colors.textMuted }]}>
                  {responsiveness.reason}. Say &quot;I&apos;m here&quot; or tap below — never tap-only, since
                  inability to tap could be the very problem.
                </Text>
                <View style={styles.actionsRow}>
                  <PrimaryButton
                    label="I'm here"
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setCheckedIn(true);
                    }}
                    variant="primary"
                    fullWidth={false}
                  />
                  <PrimaryButton
                    label={checkInVoice.listening ? "Listening…" : "Say I'm here"}
                    onPress={() => (checkInVoice.listening ? checkInVoice.stop() : checkInVoice.start())}
                    variant="accent"
                    fullWidth={false}
                  />
                </View>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  No response escalates to a welfare check on the supervisor view — never a discipline flag.
                </Text>
              </Card>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Card accentColor={colors[severityTone[fatigue.level]]}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Fatigue</Text>
                <Badge label={fatigue.level} tone={severityTone[fatigue.level]} />
              </View>
              <Text style={[type.body, { color: colors.textMuted }]}>{fatigue.message}</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Private to you — not visible on the supervisor view.</Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(230).duration(400)}>
            <Card accentColor={colors[severityTone[machineSeverity]]}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Machine health</Text>
                <Badge label={machineSeverity} tone={severityTone[machineSeverity]} />
              </View>
              {machineFlags.length ? (
                machineFlags.map((flag) => (
                  <View key={flag.reason} style={styles.rowBetween}>
                    <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>{flag.reason}</Text>
                    <Badge label={flag.severity} tone={severityTone[flag.severity]} />
                  </View>
                ))
              ) : (
                <Text style={[type.body, { color: colors.textMuted }]}>All systems normal.</Text>
              )}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <Card accentColor={colors[severityTone[slope.level]]}>
              <View style={styles.rowBetween}>
                <Text style={[type.h2, { color: colors.textPrimary }]}>Slope stability</Text>
                <Badge label={slope.level} tone={severityTone[slope.level]} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[type.body, { color: colors.textMuted }]}>Current grade</Text>
                <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>28%</Text>
              </View>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Safe up to {slope.safeLimitPct}% on current ground conditions (tightened for wet soil) — ISO 3471 ROPS-informed margin.
              </Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(290).duration(400)}>
            <Card>
              <Text style={[type.h2, { color: colors.textPrimary }]}>Working conditions</Text>
              <View style={styles.conditionsGrid}>
                <Condition label="Heat index" value="34°C" colors={colors} />
                <Condition label="Wind" value={`${CONDITIONS.windKmh} km/h`} colors={colors} />
                <Condition label="Visibility" value={`${(CONDITIONS.visibilityM / 1000).toFixed(1)} km`} colors={colors} />
                <Condition label="On shift" value="3h 40m" colors={colors} />
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <Card accentColor={colors.info}>
              <Text style={[type.h2, { color: colors.textPrimary }]}>{idlePrompt.headline}</Text>
              <Text style={[type.body, { color: colors.textMuted }]}>{idlePrompt.body}</Text>
              {idleTagged ? (
                <Text style={[type.bodyStrong, { color: colors.safe }]}>{idleConfirmationCopy(idleTagged)}</Text>
              ) : idleChipsEnabled ? (
                <View style={styles.idleOptionsRow}>
                  {IDLE_REASON_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptics.selectionAsync();
                        tagIdle(opt.value);
                      }}
                      style={[styles.idleChip, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                    >
                      <Text style={[type.caption, { color: colors.textPrimary }]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[type.caption, { color: colors.caution }]}>
                  Machine is moving — this tap-based prompt is locked until you stop (Rule 1).
                </Text>
              )}
            </Card>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Condition({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.conditionCell}>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 72,
    gap: spacing.md,
  },
  demoToggle: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  alertCard: {
    gap: spacing.sm,
  },
  alertHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  radarWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conditionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  conditionCell: {
    minWidth: "40%",
    gap: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  idleOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  idleChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
});
