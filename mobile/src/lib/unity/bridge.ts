// Typed contract between the app and the Unity simulator (see CLAUDE.md §3.0).
// Web: Unity runs in an <iframe>. Native: Unity (WebGL tier) runs in a WebView.
// Both use the same messages, so screens never care which one is live.

/** Where the WebGL build is served from on web (mobile/public/sim → /sim). */
export const SIM_URL = "/sim/index.html";

/** Native dev only: the Expo dev server on your laptop. Replace with your laptop's LAN IP.
 *  Later (offline, USP-5) this becomes a bundled local file. */
export const NATIVE_SIM_URL = "http://192.168.1.10:8081/sim/index.html";

// ---------- Unity → app ----------
export type SimEvent = {
  type: string;          // seatbelt_unfastened | proximity_hazard | excessive_idle | start_without_seatbelt | engine | ghost_start
  message: string;
  detail: string;
  score: number;
  time: number;
};

export type SimStatus = {
  mode: "training" | "telemetry";
  engineOn: boolean;
  seatbelt: boolean;
  score: number;
  incidents: number;
  idleSeconds: number;
  totalIdleSeconds: number;
  sessionSeconds: number;
};

export type GhostScore = {
  operator_id: string;
  ghost_operator_id: string;
  duration_s: number;
  match_pct: number;
  cycles: number;
  avg_cycle_s: number;
  ghost_cycle_s: number;
  smoothness_pct: number;
  idle_s: number;
  fuel_per_cycle_l: number;
  skill_factor: number;  // 0–1, feeds measured_skill_score in the task-time model (USP-1)
};

export type TraceFrame = { t: number; swing_deg: number; boom_deg: number; stick_deg: number; bucket_deg: number; phase: string };
export type GhostTrace = { operator_id: string; skill: string; cycle_time_s: number; frames: TraceFrame[] };

export type SimMessage =
  | { source: "unity-sim"; type: "ready"; data: Record<string, never> }
  | { source: "unity-sim"; type: "event"; data: SimEvent }
  | { source: "unity-sim"; type: "status"; data: SimStatus }
  | { source: "unity-sim"; type: "ghost_score"; data: GhostScore }
  | { source: "unity-sim"; type: "ghost_trace"; data: GhostTrace };

const MESSAGE_TYPES: readonly string[] = ["ready", "event", "status", "ghost_score", "ghost_trace"];

export function parseSimMessage(raw: unknown): SimMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as { source?: unknown; type?: unknown };
  if (m.source !== "unity-sim" || typeof m.type !== "string" || !MESSAGE_TYPES.includes(m.type)) return null;
  return raw as SimMessage;
}

// ---------- app → Unity ----------
export type SimCommand = { object: "Excavator" | "Ghost"; method: string; arg: string };

export type TelemetryRow = {
  time: string;
  engineOn: boolean;
  seatbelt: boolean;
  loadCycles: number;
  idlePct: number;
};

export const SimCommands = {
  setMode: (mode: "training" | "telemetry"): SimCommand => ({ object: "Excavator", method: "SetMode", arg: mode }),
  telemetry: (row: TelemetryRow): SimCommand => ({ object: "Excavator", method: "SetTelemetry", arg: JSON.stringify(row) }),
  loadGhostTrace: (trace: GhostTrace): SimCommand => ({ object: "Ghost", method: "LoadTrace", arg: JSON.stringify(trace) }),
};

// ---------- component contract (shared by UnitySim.tsx and UnitySim.web.tsx) ----------
export type UnitySimHandle = { send: (cmd: SimCommand) => void };
export type UnitySimProps = { onMessage: (msg: SimMessage) => void };

// Seed telemetry (CLAUDE.md §1) as sim rows. idlePct from engine-hour deltas; first row has no prior reading.
export const SEED_TELEMETRY_ROWS: TelemetryRow[] = [
  { time: "2025-05-01 08:00", engineOn: true, seatbelt: true, loadCycles: 12, idlePct: 0 },
  { time: "2025-05-01 10:00", engineOn: true, seatbelt: false, loadCycles: 2, idlePct: 70 },
  { time: "2025-05-01 14:00", engineOn: true, seatbelt: true, loadCycles: 10, idlePct: 15 },
  { time: "2025-05-02 09:00", engineOn: true, seatbelt: false, loadCycles: 1, idlePct: 27 },
];
