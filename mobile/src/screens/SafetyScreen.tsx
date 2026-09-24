import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

import { DEMO_MACHINE_MODEL } from "../components/AppShell";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  GaugeIcon,
  HazardIcon,
  MicIcon,
  MoonSmallIcon,
  PauseIcon,
  PlayIcon,
  PulseIcon,
  RadioIcon,
  RotateIcon,
  ShieldIcon,
  SlopeIcon,
  UserIcon,
  WindIcon,
  WrenchIcon,
  XIcon,
} from "../components/icons";
import { CardHeader, Columns, Grid, IconTile, Page, SectionTitle } from "../components/Page";
import { PrimaryButton } from "../components/PrimaryButton";
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
import { radius, spacing, type } from "../theme/tokens";

const RADAR_SIZE = 340;
const CENTER = RADAR_SIZE / 2;
const DISPLAY_RADIUS = CENTER - 16;

// Demo conditions reproducing CLAUDE.md's seed-anchored narrative in fixed visibility/
// wind. The active `beat` (shared with the Demo Panel via useDemoStore, so a presenter
// can drive this screen remotely) only changes swing state, seatbelt state, and the
// worker's fixed distance — everything else (zone radii, seatbelt alert level,
// near-miss trigger) is the REAL lib/safety math reacting to those inputs, exactly as
// it would from live telemetry (USP-4: condition-adaptive envelope; Rule 1: input
// lockout while moving).
const SIMULATION_TICK_MS = 100;
const PHASE_DURATION_MS = 4_000;

type BeatConfig = {
  isSwinging: boolean;
  seatbeltUnfastened: boolean;
  from: { workerDistanceM: number; visibilityM: number; windKmh: number };
  to: { workerDistanceM: number; visibilityM: number; windKmh: number };
};

const BEAT_CONFIG: Record<DemoBeat, BeatConfig> = {
  normal: {
    isSwinging: false, seatbeltUnfastened: false,
    from: { workerDistanceM: 28, visibilityM: 3000, windKmh: 10 }, to: { workerDistanceM: 25, visibilityM: 2500, windKmh: 14 },
  },
  seatbelt_idle: {
    isSwinging: false, seatbeltUnfastened: true,
    from: { workerDistanceM: 25, visibilityM: 2500, windKmh: 14 }, to: { workerDistanceM: 23, visibilityM: 2200, windKmh: 16 },
  },
  approaching: {
    isSwinging: true, seatbeltUnfastened: false,
    from: { workerDistanceM: 23, visibilityM: 2200, windKmh: 16 }, to: { workerDistanceM: 11, visibilityM: 1900, windKmh: 20 },
  },
  red_alert: {
    isSwinging: true, seatbeltUnfastened: false,
    from: { workerDistanceM: 11, visibilityM: 1900, windKmh: 20 }, to: { workerDistanceM: 7, visibilityM: 1700, windKmh: 24 },
  },
  recovery: {
    isSwinging: false, seatbeltUnfastened: false,
    from: { workerDistanceM: 7, visibilityM: 1700, windKmh: 24 }, to: { workerDistanceM: 28, visibilityM: 2600, windKmh: 12 },
  },
};

const interpolate = (from: number, to: number, progress: number) => from + (to - from) * progress;

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
  const blindSpotStart = polarToXY(120, redPx);
  const blindSpotEnd = polarToXY(240, redPx);
  const dotColor = zoneColor(colors, workerZone);
  const gridLine = colors.mode === "light" ? "rgba(28,26,23,0.06)" : "rgba(255,255,255,0.05)";
  const machineDark = "#2B2620";
  const labelText = `WORKER · ${workerDistanceM.toFixed(1)} m`;
  const labelW = labelText.length * 6.2 + 14;
  const labelX = Math.min(Math.max(worker.x + 14, 4), RADAR_SIZE - labelW - 4);
  const labelY = Math.min(worker.y + 10, RADAR_SIZE - 22);
  const gridSteps = Array.from({ length: Math.floor(RADAR_SIZE / 20) + 1 }, (_, k) => k * 20);

  return (
    <View style={styles.radarWrap}>
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        {gridSteps.map((v) => (
          <G key={v}>
            <Line x1={v} y1={0} x2={v} y2={RADAR_SIZE} stroke={gridLine} strokeWidth={1} />
            <Line x1={0} y1={v} x2={RADAR_SIZE} y2={v} stroke={gridLine} strokeWidth={1} />
          </G>
        ))}
        <Circle cx={CENTER} cy={CENTER} r={DISPLAY_RADIUS} fill={`${colors.safe}10`} stroke={`${colors.safe}66`} strokeWidth={1.2} />
        <Circle cx={CENTER} cy={CENTER} r={amberPx} fill={`${colors.caution}14`} stroke={colors.textPrimary} strokeOpacity={0.55} strokeWidth={1.2} />
        <Circle cx={CENTER} cy={CENTER} r={redPx} fill={`${colors.danger}1C`} stroke={colors.textPrimary} strokeOpacity={0.7} strokeWidth={1.2} />
        <Line x1={CENTER} y1={CENTER - DISPLAY_RADIUS} x2={CENTER} y2={CENTER + DISPLAY_RADIUS} stroke={colors.textPrimary} strokeOpacity={0.12} strokeWidth={1} />
        <Line x1={CENTER - DISPLAY_RADIUS} y1={CENTER} x2={CENTER + DISPLAY_RADIUS} y2={CENTER} stroke={colors.textPrimary} strokeOpacity={0.12} strokeWidth={1} />

        {/* Rear blind-spot sector (ISO 5006), tinted by how hot it is right now */}
        <Polygon
          points={`${CENTER},${CENTER} ${blindSpotStart.x},${blindSpotStart.y} ${blindSpotEnd.x},${blindSpotEnd.y}`}
          fill={workerZone === "red" ? `${colors.danger}33` : `${colors.danger}14`}
        />

        {/* Top-down excavator: tracks, yellow upper, cab, boom pointing forward */}
        <Rect x={CENTER - 30} y={CENTER - 34} width={9} height={68} rx={3} fill={machineDark} />
        <Rect x={CENTER + 21} y={CENTER - 34} width={9} height={68} rx={3} fill={machineDark} />
        <Rect x={CENTER - 23} y={CENTER - 30} width={46} height={60} rx={6} fill={colors.accent} stroke={machineDark} strokeWidth={2} />
        <Rect x={CENTER - 14} y={CENTER - 18} width={28} height={30} rx={3} fill={machineDark} opacity={0.85} />
        <Rect x={CENTER - 5} y={CENTER - 72} width={10} height={44} rx={2} fill={colors.accent} stroke={machineDark} strokeWidth={1.5} />
        <Rect x={CENTER - 11} y={CENTER - 82} width={22} height={12} rx={2} fill={colors.accent} stroke={machineDark} strokeWidth={1.5} />
        <Rect x={CENTER + 36} y={CENTER - 8} width={50} height={16} rx={3} fill={colors.hero} />
        <SvgText x={CENTER + 61} y={CENTER + 3.5} fill={colors.heroText} fontSize={9} fontFamily="Inter_700Bold" textAnchor="middle">
          {DEMO_MACHINE_ID}
        </SvgText>

        {/* Worker marker + label */}
        <Circle cx={worker.x} cy={worker.y} r={15} fill={dotColor} opacity={0.18} />
        <Circle cx={worker.x} cy={worker.y} r={9} fill={dotColor} stroke="#FFFFFF" strokeWidth={2} />
        <Circle cx={worker.x} cy={worker.y - 2.5} r={2.2} fill="#FFFFFF" />
        <Path d={`M ${worker.x - 4} ${worker.y + 4.5} Q ${worker.x} ${worker.y - 1} ${worker.x + 4} ${worker.y + 4.5}`} fill="#FFFFFF" />
        <Rect x={labelX} y={labelY} width={labelW} height={18} rx={3} fill={colors.hero} />
        <SvgText x={labelX + labelW / 2} y={labelY + 12.5} fill={colors.heroText} fontSize={9.5} fontFamily="Inter_700Bold" textAnchor="middle">
          {labelText}
        </SvgText>
      </Svg>
      <View style={[styles.northChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[type.small, { color: colors.textSecondary, fontSize: 10, fontFamily: "Inter_700Bold" }]}>N ↑</Text>
      </View>
      <View style={[styles.legendChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LegendDot color={colors.danger} label="Red zone" />
        <LegendDot color={colors.caution} label="Amber zone" />
        <LegendDot color={colors.safe} label="Clear" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[type.small, { color: colors.textPrimary, fontSize: 10.5, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
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
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [phaseElapsedMs, setPhaseElapsedMs] = useState(0);
  const phaseElapsedRef = useRef(0);
  const beat = useDemoStore((s) => s.beat);
  const nextBeat = useDemoStore((s) => s.nextBeat);

  const confirmVoice = useVoiceInput("en");
  const checkInVoice = useVoiceInput("en");

  // The simulator produces a new telemetry reading ten times per second. The zone
  // calculation below is deliberately run from those moving values on every render.
  useEffect(() => {
    if (!isSimulationRunning) return;
    const timer = setInterval(() => {
      phaseElapsedRef.current += SIMULATION_TICK_MS;
      if (phaseElapsedRef.current >= PHASE_DURATION_MS) {
        phaseElapsedRef.current = 0;
        nextBeat();
      }
      setPhaseElapsedMs(phaseElapsedRef.current);
    }, SIMULATION_TICK_MS);
    return () => clearInterval(timer);
  }, [isSimulationRunning, nextBeat]);

  // --- Real lib/safety computation, driven by the running telemetry loop ---
  const phaseProgress = Math.min(phaseElapsedMs / PHASE_DURATION_MS, 1);
  const phase = BEAT_CONFIG[beat];
  const { isSwinging, seatbeltUnfastened } = phase;
  const workerDistanceM = interpolate(phase.from.workerDistanceM, phase.to.workerDistanceM, phaseProgress);
  const visibilityM = interpolate(phase.from.visibilityM, phase.to.visibilityM, phaseProgress);
  const windKmh = interpolate(phase.from.windKmh, phase.to.windKmh, phaseProgress);
  const precipMm = 0;
  const travelKmh = 0; // swinging in place, not traveling
  const swingRateDps = isSwinging ? 8 : 0;
  const belt = seatbeltAlert(true, travelKmh, swingRateDps, seatbeltUnfastened, 12);
  const zones = proximityZones("excavator", visibilityM, precipMm, windKmh, isSwinging, false, true);
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

  const zoneTone = workerZone === "red" ? "danger" : workerZone === "amber" ? "caution" : "safe";
  const zoneText = workerZone === "red" ? "Inside red zone" : workerZone === "amber" ? "Inside amber zone" : "Outside warning zones";
  const bannerBg = { danger: colors.dangerSoft, caution: colors.cautionSoft, safe: colors.safeSoft }[zoneTone];
  const bannerFg = colors[zoneTone];

  return (
    <Page
      eyebrow="Operational awareness · Sector B"
      title="Live proximity"
      subtitle="Real-time view around your machine and work zone."
      status={isSimulationRunning ? { label: "LIVE — Running", tone: "safe" } : { label: "Paused", tone: "neutral" }}
    >
      <Card style={styles.machineStrip}>
        <View style={styles.stripLeft}>
          <IconTile bg={colors.dangerSoft} size={36}>
            <RadioIcon color={colors.danger} size={18} />
          </IconTile>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.caption, { color: colors.textPrimary }]}>
              <Text style={{ fontFamily: "Inter_700Bold" }}>{DEMO_MACHINE_MODEL}</Text>
              <Text style={{ color: colors.textSecondary }}> · {DEMO_MACHINE_ID} · East dig zone</Text>
            </Text>
            <Text style={[type.small, { color: colors.textMuted }]}>
              Proximity monitoring active · Demo beat: {DEMO_BEAT_LABEL[beat]} (also drivable from the Demo Panel)
            </Text>
          </View>
        </View>
        <View style={styles.stripActions}>
          <Pressable
            testID="safety-simulation-toggle"
            onPress={() => {
              Haptics.selectionAsync();
              setIsSimulationRunning((running) => !running);
            }}
            style={[styles.stripButton, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
          >
            {isSimulationRunning ? <PauseIcon color={colors.textPrimary} size={15} /> : <PlayIcon color={colors.textPrimary} size={14} />}
            <Text style={[styles.stripButtonText, { color: colors.textPrimary }]}>{isSimulationRunning ? "Pause" : "Run"}</Text>
          </Pressable>
          <Pressable
            testID="safety-demo-beat-advance"
            onPress={() => {
              Haptics.selectionAsync();
              phaseElapsedRef.current = 0;
              setPhaseElapsedMs(0);
              nextBeat();
            }}
            style={[styles.stripButton, { backgroundColor: colors.accent, borderColor: colors.accentPressed }]}
          >
            <Text style={[styles.stripButtonText, { color: colors.accentOn }]}>Next phase</Text>
            <ArrowRightIcon color={colors.accentOn} size={14} />
          </Pressable>
        </View>
      </Card>

      <Columns
        sideWidth={380}
        main={
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card style={styles.perimeterCard}>
                <View style={[styles.perimeterHeader, { borderBottomColor: colors.border }]}>
                  <CardHeader title="Equipment perimeter" subtitle="Top-down view · 30 m radius" />
                  <View style={styles.scanning}>
                    <View style={[styles.dot, { backgroundColor: isSimulationRunning ? colors.safe : colors.textMuted }]} />
                    <Text style={[type.small, { color: colors.textSecondary }]}>{isSimulationRunning ? "Scanning" : "Paused"}</Text>
                  </View>
                </View>
                <View style={[styles.radarStage, { backgroundColor: colors.surfaceSunken }]}>
                  <RadarView
                    colors={colors}
                    redM={zones.redM}
                    amberM={zones.amberM}
                    workerDistanceM={workerDistanceM}
                    workerZone={workerZone}
                  />
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(60).duration(400)}>
              <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: `${bannerFg}55` }]}>
                <HazardIcon color={bannerFg} size={20} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[type.label, { color: bannerFg, fontSize: 10 }]}>
                    {workerZone === "red" ? "IMMEDIATE ATTENTION" : `${workerZone.toUpperCase()} ZONE`} · REAR SECTOR ·{" "}
                    {isSwinging ? "SWING IN PROGRESS" : "STATIONARY"}
                  </Text>
                  <Text style={[type.h2, { color: colors.textPrimary }]}>
                    {workerZone === "red" ? "Worker in blind spot while swinging" : "Worker in rear sector"}
                  </Text>
                  <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
                    Zone widened for visibility ({(visibilityM / 1000).toFixed(1)} km) and wind ({windKmh.toFixed(1)} km/h) — red{" "}
                    {zones.redM.toFixed(1)} m, amber {zones.amberM.toFixed(1)} m. Worker at {workerDistanceM.toFixed(1)} m.
                  </Text>
                </View>
              </View>
            </Animated.View>

            <SectionTitle title="Safety signals" />
            <Grid cols={2}>
              <SignalCard
                icon={<ShieldIcon color={colors.textSecondary} size={16} />}
                title="Seatbelt"
                badge={<Badge label={seatbeltUnfastened ? "Unfastened" : "Fastened"} tone={seatbeltUnfastened ? "danger" : "safe"} />}
                colors={colors}
              >
                <KeyValue label="Engine / motion" value={`On · ${isSwinging ? "swinging" : "idle"}`} colors={colors} />
                <Text style={[type.small, { color: colors.textMuted }]}>
                  {belt === "hard"
                    ? "Loud alert — unfastened while moving/swinging past 5s."
                    : belt === "soft"
                      ? "Quiet reminder — unfastened while stationary."
                      : "No alert."}
                </Text>
              </SignalCard>

              <SignalCard
                icon={<MoonSmallIcon color={colors.textSecondary} size={16} />}
                title="Fatigue"
                badge={<Badge label={fatigue.level} tone={severityTone[fatigue.level]} />}
                colors={colors}
              >
                <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>{fatigue.message}</Text>
                <Text style={[type.small, { color: colors.textMuted }]}>Private to you — not visible on the supervisor view.</Text>
              </SignalCard>

              <SignalCard
                icon={<WrenchIcon color={colors.textSecondary} size={16} />}
                title="Machine health"
                badge={<Badge label={machineSeverity} tone={severityTone[machineSeverity]} />}
                colors={colors}
              >
                {machineFlags.length ? (
                  machineFlags.map((flag) => (
                    <View key={flag.reason} style={styles.flagRow}>
                      <View style={[styles.dot, { backgroundColor: colors[severityTone[flag.severity]], marginTop: 6 }]} />
                      <Text style={[type.small, { color: colors.textSecondary, flex: 1, lineHeight: 18 }]}>{flag.reason}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[type.small, { color: colors.textMuted }]}>All systems normal.</Text>
                )}
              </SignalCard>

              <SignalCard
                icon={<SlopeIcon color={colors.textSecondary} size={16} />}
                title="Slope stability"
                badge={<Badge label={slope.level} tone={severityTone[slope.level]} />}
                colors={colors}
              >
                <KeyValue label="Current grade" value="28%" colors={colors} />
                <Text style={[type.small, { color: colors.textMuted, lineHeight: 18 }]}>
                  Safe up to {slope.safeLimitPct}% on current ground conditions (tightened for wet soil) — ISO 3471 ROPS-informed margin.
                </Text>
              </SignalCard>
            </Grid>
          </>
        }
        side={
          <>
            <Animated.View entering={FadeInDown.delay(40).duration(400)}>
              <Card>
                <CardHeader
                  eyebrow="Live calculations"
                  title="Work zone conditions"
                  right={<PulseIcon color={colors.safe} size={18} />}
                />
                <View style={styles.metricGrid}>
                  <Metric
                    icon={<UserIcon color={colors.textMuted} size={13} />}
                    label="Worker distance"
                    value={`${workerDistanceM.toFixed(1)} m`}
                    note={zoneText}
                    noteColor={colors[zoneTone]}
                    colors={colors}
                  />
                  <Metric
                    icon={<WindIcon color={colors.textMuted} size={13} />}
                    label="Wind speed"
                    value={`${windKmh.toFixed(1)} km/h`}
                    note={windKmh > 20 ? "Gusting" : "Stable"}
                    noteColor={windKmh > 20 ? colors.caution : colors.safe}
                    colors={colors}
                  />
                  <Metric
                    icon={<EyeIcon color={colors.textMuted} size={13} />}
                    label="Visibility"
                    value={visibilityM >= 2000 ? "Good" : "Reduced"}
                    note={`~ ${(visibilityM / 1000).toFixed(1)} km`}
                    noteColor={visibilityM >= 2000 ? colors.safe : colors.caution}
                    colors={colors}
                  />
                  <Metric
                    icon={<RotateIcon color={colors.textMuted} size={13} />}
                    label="Swing status"
                    value={isSwinging ? "Active" : "Stationary"}
                    note={isSwinging ? `Swinging · ${swingRateDps}°/s` : "No swing"}
                    noteColor={isSwinging ? colors.caution : colors.safe}
                    colors={colors}
                  />
                  <Metric
                    icon={<RadioIcon color={colors.textMuted} size={13} />}
                    label="Red-zone radius"
                    value={`${zones.redM.toFixed(1)} m`}
                    note="Dynamic boundary"
                    noteColor={colors.danger}
                    colors={colors}
                  />
                  <Metric
                    icon={<RadioIcon color={colors.textMuted} size={13} />}
                    label="Amber-zone radius"
                    value={`${zones.amberM.toFixed(1)} m`}
                    note="Dynamic boundary"
                    noteColor={colors.caution}
                    colors={colors}
                  />
                </View>
                <View style={[styles.calcFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.scanning}>
                    <View style={[styles.dot, { backgroundColor: colors.safe }]} />
                    <Text style={[type.small, { color: colors.textSecondary, fontSize: 11 }]}>Sensor feed connected</Text>
                  </View>
                  <Text style={[styles.mono, { color: colors.textMuted }]}>
                    CALC TICK {phaseElapsedMs / 1000}s / {PHASE_DURATION_MS / 1000}s
                  </Text>
                </View>
              </Card>
            </Animated.View>

            {draft && draft.status === "pending" ? (
              <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                <Card>
                  <CardHeader eyebrow="Near-miss review" title="Confirm this event" right={<Badge label="Needs review" tone="danger" />} />
                  <Text style={[type.caption, { color: colors.textSecondary, lineHeight: 20 }]}>
                    Auto-logged: {draft.trigger.replace(/_/g, " ")}. Confirm to save, or dismiss if this was a false read.
                  </Text>
                  <View style={[styles.eventMeta, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
                    <RadioIcon color={colors.danger} size={14} />
                    <Text style={[type.small, { color: colors.textSecondary }]}>
                      {new Date(draft.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} ·{" "}
                      {DEMO_MACHINE_ID} · Sector B
                    </Text>
                  </View>
                  {tapAllowed ? (
                    <View style={styles.splitRow}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          testID="near-miss-confirm"
                          label="Confirm"
                          onPress={() => confirmDraft(draft)}
                          variant="primary"
                          icon={<CheckIcon color={colors.accentOn} size={15} />}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          testID="near-miss-dismiss"
                          label="Dismiss"
                          onPress={() => setDraft((d) => (d ? { ...d, status: "dismissed" } : d))}
                          variant="secondary"
                          icon={<XIcon color={colors.textPrimary} size={14} />}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.lockNote, { backgroundColor: colors.cautionSoft }]}>
                      <Text style={[type.small, { color: colors.caution, lineHeight: 18 }]}>
                        Machine is moving — tap confirm/dismiss is locked (Rule 1). It&apos;ll surface again the moment you stop, or
                        confirm right now by voice.
                      </Text>
                    </View>
                  )}
                  <PrimaryButton
                    label={confirmVoice.listening ? "Listening…" : "Confirm by voice"}
                    onPress={() => (confirmVoice.listening ? confirmVoice.stop() : confirmVoice.start())}
                    variant="accent"
                    icon={<MicIcon color={colors.textPrimary} size={15} />}
                  />
                </Card>
              </Animated.View>
            ) : draft ? (
              <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                <Card>
                  <CardHeader
                    eyebrow="Near-miss review"
                    title={`Near-miss ${draft.status}`}
                    right={<Badge label={draft.status} tone={draft.status === "confirmed" ? "safe" : "neutral"} />}
                  />
                </Card>
              </Animated.View>
            ) : null}

            {responsiveness.shouldCheckIn && !checkedIn ? (
              <Animated.View entering={FadeInDown.delay(110).duration(400)}>
                <Card>
                  <CardHeader eyebrow="Operator check-in" title="Are you okay?" right={<Badge label="Check-in" tone="caution" />} />
                  <Text style={[type.caption, { color: colors.textSecondary, lineHeight: 20 }]}>
                    {responsiveness.reason}. Say &quot;I&apos;m here&quot; or tap below — never tap-only, since inability to tap
                    could be the very problem.
                  </Text>
                  <View style={styles.splitRow}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="I'm here"
                        onPress={() => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          setCheckedIn(true);
                        }}
                        variant="primary"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label={checkInVoice.listening ? "Listening…" : "Say I'm here"}
                        onPress={() => (checkInVoice.listening ? checkInVoice.stop() : checkInVoice.start())}
                        variant="accent"
                        icon={<MicIcon color={colors.textPrimary} size={15} />}
                      />
                    </View>
                  </View>
                  <Text style={[type.small, { color: colors.textMuted }]}>
                    No response escalates to a welfare check on the supervisor view — never a discipline flag.
                  </Text>
                </Card>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <Card>
                <CardHeader eyebrow="Idle intent" title={idlePrompt.headline} right={<ClockIcon color={colors.info} size={18} />} />
                <Text style={[type.caption, { color: colors.textSecondary, lineHeight: 20 }]}>{idlePrompt.body}</Text>
                {idleTagged ? (
                  <View style={[styles.lockNote, { backgroundColor: colors.safeSoft }]}>
                    <Text style={[type.caption, { color: colors.safe, fontFamily: "Inter_600SemiBold" }]}>
                      {idleConfirmationCopy(idleTagged)}
                    </Text>
                  </View>
                ) : idleChipsEnabled ? (
                  <View style={styles.idleOptionsRow}>
                    {IDLE_REASON_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          Haptics.selectionAsync();
                          tagIdle(opt.value);
                        }}
                        style={({ hovered }) => [
                          styles.idleChip,
                          { backgroundColor: hovered ? colors.accentSoft : colors.surface, borderColor: colors.borderStrong },
                        ]}
                      >
                        <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.lockNote, { backgroundColor: colors.cautionSoft }]}>
                    <Text style={[type.small, { color: colors.caution }]}>
                      Machine is moving — this tap-based prompt is locked until you stop (Rule 1).
                    </Text>
                  </View>
                )}
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(170).duration(400)}>
              <Card>
                <CardHeader eyebrow="Environment" title="Working conditions" right={<GaugeIcon color={colors.textSecondary} size={18} />} />
                <View style={styles.metricGrid}>
                  <Condition label="Heat index" value="34°C" colors={colors} />
                  <Condition label="Wind" value={`${windKmh.toFixed(1)} km/h`} colors={colors} />
                  <Condition label="Visibility" value={`${(visibilityM / 1000).toFixed(1)} km`} colors={colors} />
                  <Condition label="On shift" value="3h 40m" colors={colors} />
                </View>
              </Card>
            </Animated.View>
          </>
        }
      />
    </Page>
  );
}

function SignalCard({
  icon,
  title,
  badge,
  colors,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge: ReactNode;
  colors: ReturnType<typeof useColors>;
  children: ReactNode;
}) {
  return (
    <Card style={styles.signalCard}>
      <View style={styles.signalHeader}>
        <IconTile bg={colors.surfaceRaised} size={30}>
          {icon}
        </IconTile>
        <Text style={[type.bodyStrong, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>
        {badge}
      </View>
      {children}
    </Card>
  );
}

function KeyValue({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[type.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>{value}</Text>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  noteColor,
  colors,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  noteColor: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricLabel}>
        {icon}
        <Text style={[type.small, { color: colors.textMuted, fontSize: 11 }]}>{label}</Text>
      </View>
      <Text style={[type.metric, { color: colors.textPrimary }]}>{value}</Text>
      <View style={styles.metricLabel}>
        <View style={[styles.dot, { backgroundColor: noteColor, width: 5, height: 5 }]} />
        <Text style={[type.small, { color: noteColor, fontSize: 10.5, fontFamily: "Inter_600SemiBold" }]}>{note}</Text>
      </View>
    </View>
  );
}

function Condition({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.metricCell}>
      <Text style={[type.small, { color: colors.textMuted, fontSize: 11 }]}>{label}</Text>
      <Text style={[type.h2, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  machineStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  stripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    flex: 1,
    minWidth: 240,
  },
  stripActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stripButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  stripButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
  },
  perimeterCard: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  perimeterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  scanning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  radarStage: {
    paddingVertical: spacing.md,
  },
  radarWrap: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    width: RADAR_SIZE,
    height: RADAR_SIZE + 36,
  },
  northChip: {
    position: "absolute",
    top: 4,
    right: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  legendChip: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md + 2,
  },
  signalCard: {
    flex: 1,
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  flagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.md + 2,
    marginTop: spacing.xs,
  },
  metricCell: {
    width: "50%",
    gap: 4,
    paddingRight: spacing.sm,
  },
  metricLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  calcFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: spacing.sm + 4,
    marginTop: spacing.xs,
  },
  mono: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9.5,
    letterSpacing: 1,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  splitRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  lockNote: {
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  idleOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  idleChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
