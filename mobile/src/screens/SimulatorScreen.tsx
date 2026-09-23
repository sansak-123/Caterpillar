// Example screen: embed the simulator and react to its messages.
// Route it from src/app/(tabs)/training.tsx:  export { default } from "../../screens/SimulatorScreen";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import UnitySim from "../components/UnitySim";
import { SEED_TELEMETRY_ROWS, SimCommands, type GhostScore, type SimMessage, type SimStatus, type UnitySimHandle } from "../lib/unity/bridge";

type LogItem = { id: string; text: string; kind: "incident" | "ghost" };

export default function SimulatorScreen() {
  const sim = useRef<UnitySimHandle>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [lastScore, setLastScore] = useState<GhostScore | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);

  const onMessage = useCallback((m: SimMessage) => {
    switch (m.type) {
      case "ready":
        setReady(true);
        break;
      case "status":
        setStatus(m.data);
        break;
      case "event":
        if (m.data.type === "engine" || m.data.type === "ghost_start") break;
        // TODO: write to incidents table + outbox (lib/db) — training incidents, tag source: "simulator"
        setLog(l => [{ id: `${Date.now()}`, text: m.data.message, kind: "incident" as const }, ...l].slice(0, 50));
        break;
      case "ghost_score":
        // TODO: append to outbox as training_progress → backend updates ghost_skill_factor (USP-1)
        setLastScore(m.data);
        setLog(l => [{ id: `${Date.now()}`, text: `Ghost Operator: skill ${m.data.skill_factor.toFixed(2)}, match ${Math.round(m.data.match_pct)}%`, kind: "ghost" as const }, ...l].slice(0, 50));
        break;
      case "ghost_trace":
        // TODO: save as a new expert trace (tacit-knowledge capture)
        break;
    }
  }, []);

  const replaySeedDay = () => {
    sim.current?.send(SimCommands.setMode("telemetry"));
    SEED_TELEMETRY_ROWS.forEach((row, i) => setTimeout(() => sim.current?.send(SimCommands.telemetry(row)), 500 + i * 5000));
  };

  return (
    <View style={s.screen}>
      <View style={s.simBox}>
        <UnitySim ref={sim} onMessage={onMessage} />
      </View>

      <View style={s.row}>
        <Btn label="Operator training" onPress={() => sim.current?.send(SimCommands.setMode("training"))} />
        <Btn label="Replay sample day" onPress={replaySeedDay} />
      </View>

      <Text style={s.meta}>
        {ready ? "Simulator connected" : "Loading simulator…"}
        {status ? `  ·  Engine ${status.engineOn ? "on" : "off"}  ·  Seatbelt ${status.seatbelt ? "fastened" : "UNFASTENED"}  ·  Score ${status.score}` : ""}
      </Text>
      {lastScore && <Text style={s.meta}>Last skill factor: {lastScore.skill_factor.toFixed(2)}</Text>}

      <ScrollView style={s.log}>
        {log.map(item => (
          <Text key={item.id} style={[s.logItem, item.kind === "ghost" && s.ghost]}>{item.text}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, pressed && s.btnPressed]}>
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 12, gap: 10, backgroundColor: "#15181b" },
  simBox: { flex: 1, minHeight: 420, borderRadius: 6, overflow: "hidden", backgroundColor: "#2a2d30" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6, backgroundColor: "#f2b705" },
  btnPressed: { opacity: 0.7 },
  btnText: { color: "#15181b", fontWeight: "700", fontSize: 16 },
  meta: { color: "#d7dadd", fontSize: 14 },
  log: { maxHeight: 160 },
  logItem: { color: "#fff", borderLeftWidth: 4, borderLeftColor: "#f2b705", paddingLeft: 8, marginBottom: 6 },
  ghost: { borderLeftColor: "#4aa3df" },
});
export { SimulatorScreen };