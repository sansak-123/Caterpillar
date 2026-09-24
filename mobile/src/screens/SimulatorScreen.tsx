// Simulator page: embeds Unity, picks the scenario from the URL (?scenario=...), and handles
// near-miss drafts (USP-2), idle tags (USP-3), welfare check-ins (USP-6) and ghost scores (USP-1).
// With ?scenario=<Name> it shows a focused view for that one scenario; without it, the full dev/demo page.
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import UnitySim from "../components/UnitySim";
import {
  SCENARIOS,
  SEED_TELEMETRY_ROWS,
  SimCommands,
  getNearMissDrafts,
  latestNearMissDraft,
  saveNearMissDraft,
  toScenario,
  type GhostScore,
  type IdleTag,
  type NearMissData,
  type ScenarioName,
  type ScenarioResult,
  type ScenarioState,
  type SimMessage,
  type SimStatus,
  type UnitySimHandle,
} from "../lib/unity/bridge";

type LogKind = "incident" | "proximity" | "ghost" | "nearmiss" | "idle" | "welfare" | "result";
type LogItem = { id: string; text: string; kind: LogKind; scenario: ScenarioName; at: number };
// `corroborated` is deliberately dropped here so it can never reach the operator's screen (Rule 3).
type IdleHistoryItem = { id: string; reason: IdleTag["reason"]; idle_s: number; scenario: ScenarioName };

const IDLE_REASON_TEXT: Record<string, string> = {
  truck_wait: "waiting for truck (site delay, not your fault)",
  warmup: "warm-up",
  break: "rest break",
  other: "other",
};

const SCENARIO_LABEL: Record<ScenarioName, string> = {
  Free: "Free practice",
  GhostOperator: "Ghost Operator",
  TrenchNearWorkers: "Trench near workers",
  LoadingInRain: "Loading in rain",
  IdleDiscipline: "Idle discipline",
  NearMissReplay: "Near-miss replay",
  WelfareCheck: "Operator check-in",
};

type ScenarioInfo = { usp: string; description: string; controls: readonly (readonly [string, string])[] };

const BASE_CONTROLS = [
  ["B", "fasten / unfasten seatbelt"],
  ["Space", "engine on / off (belt first)"],
] as const;

const DIG_CONTROLS = [
  ["Up / Down", "boom"],
  ["Left / Right", "stick"],
  ["Z / X", "bucket"],
  ["Q / E", "swing"],
] as const;

const SCENARIO_INFO: Record<ScenarioName, ScenarioInfo> = {
  Free: { usp: "All", description: "Every feature on at once (dev/demo mode).", controls: [...BASE_CONTROLS, ["WASD", "drive"], ...DIG_CONTROLS] },
  GhostOperator: {
    usp: "USP-1",
    description: "Dig alongside a replay of an expert's cycle. Your skill factor feeds your own task-time estimates.",
    controls: [...BASE_CONTROLS, ["G", "start / stop a 60 s ghost session"], ...DIG_CONTROLS, ["Follow", "the blue arm in the panel"]],
  },
  NearMissReplay: {
    usp: "USP-2",
    description: "Drive near workers with live red/amber zones; near-misses are captured automatically, then replayed in slow motion for you to try again.",
    controls: [
      ["Watch", "opens on a replay (your latest draft, or the demo)"],
      ["T / R", "now you try / watch again"],
      ["P", "stop the replay and drive; P again replays the latest draft"],
      ...BASE_CONTROLS,
      ["WASD", "drive (S = reverse grows the zone)"],
      ["Q / E", "swing: red zone + swing/reverse = draft"],
    ],
  },
  IdleDiscipline: {
    usp: "USP-3",
    description: "Wait for the truck without wasting fuel. One tap puts the delay on record as not your fault.",
    controls: [...BASE_CONTROLS, ["1-4", "why the machine is waiting"], ["Space", "switch off while you wait"], ...DIG_CONTROLS],
  },
  LoadingInRain: {
    usp: "USP-4",
    description: "Rain and fog cut what you can see, so the red and amber zones grow to match.",
    controls: [...BASE_CONTROLS, ["WASD", "drive (S = reverse grows the zone)"], ...DIG_CONTROLS],
  },
  TrenchNearWorkers: {
    usp: "USP-4 + USP-2",
    description: "Clear weather, workers walking past the trench. Keep them out of the red zone while you swing or reverse.",
    controls: [...BASE_CONTROLS, ["WASD", "drive (S = reverse grows the zone)"], ...DIG_CONTROLS],
  },
  WelfareCheck: {
    usp: "USP-6",
    description: "Leave the controls untouched too long and the cab asks \"Are you OK?\" (voice-answerable). No answer escalates to a welfare check, never a discipline flag.",
    controls: [...BASE_CONTROLS, ["Hands off", "10 s with belt on + engine on"], ["Y", "\"I'm OK\" (or touch any control)"], ["Wait", "10 s more to see the escalation"]],
  },
};

// Which log entries belong to each scenario's section
const LOG_KINDS: Record<ScenarioName, readonly LogKind[]> = {
  Free: ["incident", "proximity", "ghost", "nearmiss", "idle", "welfare", "result"],
  GhostOperator: ["incident", "ghost"],
  NearMissReplay: ["incident", "proximity", "nearmiss", "result"],
  IdleDiscipline: ["incident", "idle"],
  LoadingInRain: ["incident", "proximity"],
  TrenchNearWorkers: ["incident", "proximity", "nearmiss"],
  WelfareCheck: ["incident", "welfare"],
};

export default function SimulatorScreen() {
  const params = useLocalSearchParams<{ scenario?: string | string[] }>();
  const rawScenario = Array.isArray(params.scenario) ? params.scenario[0] : params.scenario;
  const focused = toScenario(rawScenario) !== "Free";

  const sim = useRef<UnitySimHandle>(null);
  const scenarioRef = useRef<ScenarioName>(toScenario(rawScenario));
  const [scenario, setScenario] = useState<ScenarioName>(() => toScenario(rawScenario));
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [lastScore, setLastScore] = useState<GhostScore | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioResult | null>(null);
  const [drafts, setDrafts] = useState<NearMissData[]>(getNearMissDrafts());
  const [draftScenario, setDraftScenario] = useState<Record<string, ScenarioName>>({});
  const [idleHistory, setIdleHistory] = useState<IdleHistoryItem[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  // Handshake: what Unity says it actually loaded. Re-request once if it differs (e.g. Unity fell back to Free).
  const [loaded, setLoaded] = useState<ScenarioState | null>(null);
  const resentFor = useRef<ScenarioName | null>(null);
  const readyRef = useRef(false);

  const addLog = useCallback((text: string, kind: LogKind) => {
    const item: LogItem = { id: `${Date.now()}-${Math.random()}`, text, kind, scenario: scenarioRef.current, at: Date.now() };
    setLog(l => [item, ...l].slice(0, 60));
  }, []);

  const runScenario = useCallback((name: ScenarioName, nearMiss?: NearMissData) => {
    scenarioRef.current = name;
    setScenario(name);
    const nm = name === "NearMissReplay" ? nearMiss ?? latestNearMissDraft() : undefined;
    sim.current?.send(SimCommands.loadScenario(name, nm ? { nearMiss: nm } : undefined));
  }, []);

  const onMessage = useCallback((m: SimMessage) => {
    switch (m.type) {
      case "ready":
        readyRef.current = true;
        setReady(true);
        runScenario(scenarioRef.current);
        break;
      case "status":
        setStatus(m.data);
        break;
      case "event": {
        const t = m.data.type;
        if (t === "engine" || t === "ghost_start") break;
        // TODO: incidents table + outbox (lib/db), source: "simulator"
        const kind: LogKind = t.startsWith("welfare") ? "welfare" : t.startsWith("proximity") ? "proximity" : "incident";
        addLog(m.data.message, kind);
        break;
      }
      case "ghost_score":
        // TODO: training_progress + outbox → backend updates ghost_skill_factor (USP-1)
        setLastScore(m.data);
        addLog(`Ghost Operator: skill ${m.data.skill_factor.toFixed(2)}, match ${Math.round(m.data.match_pct)}%`, "ghost");
        break;
      case "near_miss":
        // USP-2: DRAFT near-miss. TODO: incidents (is_near_miss=true, status=draft) + outbox; confirm only when stationary (Rule 1)
        saveNearMissDraft(m.data);
        {
          const id = m.data.id, from = scenarioRef.current;
          setDraftScenario(d => ({ ...d, [id]: from }));
        }
        setDrafts(getNearMissDrafts());
        addLog(`Near-miss draft: ${m.data.caption}`, "nearmiss");
        break;
      case "idle_tag": {
        // USP-3: TODO idle_tags table + outbox. Never show `corroborated` to the operator (Rule 3).
        const { reason, idle_s } = m.data;
        setIdleHistory(h => [{ id: `${Date.now()}-${Math.random()}`, reason, idle_s, scenario: scenarioRef.current }, ...h].slice(0, 20));
        addLog(`Idle tagged: ${IDLE_REASON_TEXT[reason] ?? reason}`, "idle");
        break;
      }
      case "scenario_result":
        setLastResult(m.data);
        addLog(`Near-miss lesson: ${m.data.passed ? "passed" : "try again"} (${m.data.reason})`, "result");
        break;
      case "scenario_loaded": {
        setLoaded(m.data);
        const wanted = scenarioRef.current;
        if (readyRef.current && m.data.scenario !== wanted && resentFor.current !== wanted) {
          resentFor.current = wanted;
          runScenario(wanted);
        }
        break;
      }
      case "ghost_trace":
        break;
    }
  }, [addLog, runScenario]);

  const replaySeedDay = () => {
    sim.current?.send(SimCommands.setMode("telemetry"));
    SEED_TELEMETRY_ROWS.forEach((row, i) => setTimeout(() => sim.current?.send(SimCommands.telemetry(row)), 500 + i * 5000));
  };

  const visibleLog = log.filter(item => (scenario === "Free" || item.scenario === scenario) && LOG_KINDS[scenario].includes(item.kind));

  const logView = (
    <ScrollView style={s.log}>
      {visibleLog.map(item => (
        <Text key={item.id} style={[s.logItem, KIND_STYLE[item.kind]]}>{item.text}</Text>
      ))}
    </ScrollView>
  );

  if (focused) {
    const info = SCENARIO_INFO[scenario];
    return (
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable onPress={goBackToTraining} style={({ pressed }) => [s.backLink, pressed && s.pressed]}>
            <Text style={s.backText}>‹ Back to Training</Text>
          </Pressable>
          <View style={s.titleRow}>
            <Text style={s.title}>{SCENARIO_LABEL[scenario]}</Text>
            <Text style={s.uspBadge}>{info.usp}</Text>
          </View>
          <Text style={s.description}>{info.description}</Text>
          <Text style={[s.meta, loaded && loaded.scenario !== scenario ? s.mismatch : null]}>
            {loaded
              ? `Simulator running: ${SCENARIO_LABEL[toScenario(loaded.scenario)]}${loaded.scenario !== scenario ? " (not the requested scenario)" : ""}`
              : "Waiting for the simulator to confirm the scenario…"}
          </Text>
        </View>

        <View style={s.simBox}>
          <UnitySim ref={sim} onMessage={onMessage} />
        </View>

        <ScrollView style={s.focusBody} contentContainerStyle={s.focusBodyContent}>
          <Text style={s.meta}>
            {ready ? "Simulator connected" : "Loading simulator…"}
            {status ? `  ·  Engine ${status.engineOn ? "on" : "off"}  ·  Seatbelt ${status.seatbelt ? "fastened" : "UNFASTENED"}  ·  Score ${status.score}` : ""}
          </Text>

          <View style={s.columns}>
            <View style={s.panel}>
              <Text style={s.heading}>Controls</Text>
              {info.controls.map(([key, action]) => (
                <View key={`${key}-${action}`} style={s.controlRow}>
                  <Text style={s.key}>{key}</Text>
                  <Text style={s.panelText}>{action}</Text>
                </View>
              ))}
            </View>

            <View style={s.panel}>
              <ScenarioPanel
                scenario={scenario}
                status={status}
                loaded={loaded}
                lastScore={lastScore}
                lastResult={lastResult}
                drafts={drafts}
                draftScenario={draftScenario}
                idleHistory={idleHistory}
                log={visibleLog}
                onReplay={nm => runScenario("NearMissReplay", nm)}
              />
            </View>
          </View>

          {logView}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.simBox}>
        <UnitySim ref={sim} onMessage={onMessage} />
      </View>

      <View style={s.row}>
        {SCENARIOS.map(name => (
          <Chip key={name} label={SCENARIO_LABEL[name]} active={scenario === name} onPress={() => runScenario(name)} />
        ))}
        <Chip label="Replay sample day" active={false} onPress={replaySeedDay} />
      </View>

      <Text style={s.meta}>
        {ready ? "Simulator connected" : "Loading simulator…"}
        {status ? `  ·  Engine ${status.engineOn ? "on" : "off"}  ·  Seatbelt ${status.seatbelt ? "fastened" : "UNFASTENED"}  ·  Score ${status.score}` : ""}
        {status?.redRadius ? `  ·  Red zone ${status.redRadius} m / amber ${status.amberRadius} m` : ""}
        {lastScore ? `  ·  Skill ${lastScore.skill_factor.toFixed(2)}` : ""}
      </Text>

      {drafts.length > 0 && (
        <View style={s.drafts}>
          <Text style={s.heading}>Near-miss drafts (replayable lessons)</Text>
          {drafts.slice(0, 3).map(nm => (
            <View key={nm.id} style={s.draftRow}>
              <Text style={s.draftText} numberOfLines={1}>{nm.caption}</Text>
              <Chip label="Replay as lesson" active={false} onPress={() => runScenario("NearMissReplay", nm)} />
            </View>
          ))}
        </View>
      )}

      {logView}
    </View>
  );
}

export { SimulatorScreen };

function goBackToTraining() {
  if (router.canGoBack()) router.back();
  else router.replace("/training");
}

type PanelProps = {
  scenario: ScenarioName;
  status: SimStatus | null;
  loaded: ScenarioState | null;
  lastScore: GhostScore | null;
  lastResult: ScenarioResult | null;
  drafts: NearMissData[];
  draftScenario: Record<string, ScenarioName>;
  idleHistory: IdleHistoryItem[];
  log: LogItem[];
  onReplay: (nm: NearMissData) => void;
};

function ScenarioPanel({ scenario, status, loaded, lastScore, lastResult, drafts, draftScenario, idleHistory, log, onReplay }: PanelProps) {
  switch (scenario) {
    case "GhostOperator":
      return (
        <>
          <Text style={s.heading}>Latest ghost score</Text>
          {lastScore ? (
            <>
              <Stat label="Skill factor" value={lastScore.skill_factor.toFixed(2)} />
              <Stat label="Match with expert" value={`${Math.round(lastScore.match_pct)}%`} />
              <Stat label="Cycles" value={String(lastScore.cycles)} />
              <Stat
                label="Avg cycle vs expert"
                value={`${lastScore.cycles > 0 ? `${lastScore.avg_cycle_s.toFixed(1)} s` : "–"} / ${lastScore.ghost_cycle_s.toFixed(0)} s`}
              />
            </>
          ) : (
            <Text style={s.empty}>No session yet. Press B, Space, then G and follow the blue arm.</Text>
          )}
        </>
      );

    case "NearMissReplay":
      return (
        <>
          <Envelope status={status} />
          <ProximityList log={log} />
          <Text style={[s.heading, s.subHeading]}>Captured near-miss drafts</Text>
          {drafts.length === 0 ? (
            <Text style={s.empty}>None captured yet, so the built-in demo plays. Press P to drive, then swing or reverse with a worker in the red zone.</Text>
          ) : (
            <DraftList drafts={drafts.slice(0, 5)} onReplay={onReplay} />
          )}
          <Text style={[s.heading, s.subHeading]}>Last lesson result</Text>
          {lastResult ? (
            <Text style={[s.panelText, { color: lastResult.passed ? "#46a758" : "#f2b705" }]}>
              {lastResult.passed ? "Passed" : "Not yet"}: {lastResult.reason}
            </Text>
          ) : (
            <Text style={s.empty}>Watch the replay, then press T to try it yourself.</Text>
          )}
        </>
      );

    case "IdleDiscipline":
      return (
        <>
          <Text style={s.heading}>Your idle records</Text>
          {idleHistory.filter(t => t.scenario === scenario).length === 0 ? (
            <Text style={s.empty}>When the machine waits, tap why (1-4). {"It goes on record so the delay isn't held against you."}</Text>
          ) : (
            idleHistory
              .filter(t => t.scenario === scenario)
              .map(t => (
                <Text key={t.id} style={s.panelText}>
                  • {IDLE_REASON_TEXT[t.reason] ?? t.reason} · {Math.round(t.idle_s)} s idle
                </Text>
              ))
          )}
        </>
      );

    case "LoadingInRain": {
      const c = loaded?.conditions;
      return (
        <>
          <Text style={s.heading}>Current conditions</Text>
          {c ? (
            <>
              <Stat label="Visibility" value={`${Math.round(c.visibility_m)} m`} />
              <Stat label="Rain" value={`${c.precip_mm} mm/h`} />
              <Stat label="Wind" value={`${Math.round(c.wind_kmh)} km/h`} />
            </>
          ) : (
            <Text style={s.empty}>Waiting for the simulator…</Text>
          )}
          <View style={s.subHeading} />
          <Envelope status={status} />
          <ProximityList log={log} />
        </>
      );
    }

    case "TrenchNearWorkers": {
      const mine = drafts.filter(nm => draftScenario[nm.id] === scenario);
      return (
        <>
          <Envelope status={status} />
          <ProximityList log={log} />
          <Text style={[s.heading, s.subHeading]}>New near-miss drafts</Text>
          {mine.length === 0 ? (
            <Text style={s.empty}>Swing or reverse while a worker is in the red zone to capture one.</Text>
          ) : (
            <DraftList drafts={mine.slice(0, 3)} onReplay={onReplay} />
          )}
        </>
      );
    }

    case "WelfareCheck": {
      const timeline = log.filter(item => item.kind === "welfare");
      return (
        <>
          <Text style={s.heading}>Check-in timeline</Text>
          {timeline.length === 0 ? (
            <Text style={s.empty}>Fasten the belt, start the engine, then leave the controls alone for 10 s.</Text>
          ) : (
            timeline.map(item => (
              <Text key={item.id} style={s.panelText}>
                {new Date(item.at).toLocaleTimeString()}  {item.text}
              </Text>
            ))
          )}
        </>
      );
    }

    case "Free":
      return null;
  }
}

function Envelope({ status }: { status: SimStatus | null }) {
  return (
    <>
      <Text style={s.heading}>Safety envelope (live)</Text>
      <Stat label="Red zone" value={status?.redRadius ? `${status.redRadius} m` : "–"} color="#e5484d" />
      <Stat label="Amber zone" value={status?.amberRadius ? `${status.amberRadius} m` : "–"} color="#f2b705" />
      <Text style={s.panelText}>
        {status?.swinging ? "Swinging: zone enlarged" : status?.reversing ? "Reversing: zone enlarged" : "Stationary"}
      </Text>
    </>
  );
}

function ProximityList({ log }: { log: LogItem[] }) {
  const proximity = log.filter(item => item.kind === "proximity").slice(0, 5);
  return (
    <>
      <Text style={[s.heading, s.subHeading]}>Proximity</Text>
      {proximity.length === 0 ? (
        <Text style={s.empty}>No worker has entered a zone yet.</Text>
      ) : (
        proximity.map(item => <Text key={item.id} style={s.panelText}>• {item.text}</Text>)
      )}
    </>
  );
}

function DraftList({ drafts, onReplay }: { drafts: NearMissData[]; onReplay: (nm: NearMissData) => void }) {
  return (
    <>
      {drafts.map(nm => (
        <View key={nm.id} style={s.draftRow}>
          <Text style={s.draftText} numberOfLines={2}>{nm.caption}</Text>
          <Chip label="Replay as lesson" active={false} onPress={() => onReplay(nm)} />
        </View>
      ))}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.statRow}>
      <Text style={s.panelText}>{label}</Text>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 12, gap: 10, backgroundColor: "#15181b" },
  simBox: { flex: 1, minHeight: 420, borderRadius: 6, overflow: "hidden", backgroundColor: "#2a2d30" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, borderWidth: 2, borderColor: "#f2b705" },
  chipActive: { backgroundColor: "#f2b705" },
  chipText: { color: "#f2b705", fontWeight: "700", fontSize: 15 },
  chipTextActive: { color: "#15181b" },
  pressed: { opacity: 0.7 },
  meta: { color: "#d7dadd", fontSize: 14 },
  heading: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  subHeading: { marginTop: 10 },
  mismatch: { color: "#f2b705", fontWeight: "700" },
  drafts: { backgroundColor: "#1f2327", borderRadius: 6, padding: 10 },
  draftRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  draftText: { color: "#fff", flex: 1 },
  log: { maxHeight: 160 },
  logItem: { color: "#fff", borderLeftWidth: 4, paddingLeft: 8, marginBottom: 6 },
  header: { gap: 4 },
  backLink: { alignSelf: "flex-start", paddingVertical: 6 },
  backText: { color: "#f2b705", fontWeight: "700", fontSize: 15 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: "#fff", fontWeight: "800", fontSize: 22 },
  uspBadge: { color: "#15181b", backgroundColor: "#f2b705", fontWeight: "700", fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  description: { color: "#d7dadd", fontSize: 14 },
  focusBody: { flexGrow: 0, maxHeight: 360 },
  focusBodyContent: { gap: 10 },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  panel: { flex: 1, minWidth: 260, backgroundColor: "#1f2327", borderRadius: 6, padding: 10 },
  panelText: { color: "#d7dadd", fontSize: 14, marginBottom: 4 },
  controlRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  key: { color: "#f2b705", fontWeight: "700", fontSize: 14, minWidth: 96 },
  empty: { color: "#8b9196", fontSize: 14, fontStyle: "italic" },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  statValue: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const KIND_STYLE: Record<LogKind, { borderLeftColor: string }> = {
  incident: { borderLeftColor: "#f2b705" },
  proximity: { borderLeftColor: "#e5484d" },
  ghost: { borderLeftColor: "#4aa3df" },
  nearmiss: { borderLeftColor: "#e5484d" },
  idle: { borderLeftColor: "#46a758" },
  welfare: { borderLeftColor: "#b38cf2" },
  result: { borderLeftColor: "#4aa3df" },
};
