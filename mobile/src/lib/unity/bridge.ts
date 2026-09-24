// Typed contract between the app and the Unity simulator (see CLAUDE.md §3.0).
// Web: Unity runs in an <iframe>. Native: Unity (WebGL tier) runs in a WebView.

/** Where the WebGL build is served from on web (mobile/public/sim → /sim). */
export const SIM_URL = "/sim/index.html";

/** Native dev only: the Expo dev server on your laptop. Replace with your laptop's LAN IP. */
export const NATIVE_SIM_URL = "http://192.168.1.10:8081/sim/index.html";

// ---------- Unity → app ----------
export type SimEvent = {
  type: string; // proximity_hazard | proximity_amber | seatbelt_unfastened | excessive_idle | start_without_seatbelt | engine | ghost_start | welfare_checkin | welfare_ok | welfare_escalated
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
  redRadius?: number;
  amberRadius?: number;
  swinging?: boolean;
  reversing?: boolean;
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
  skill_factor: number; // 0–1, feeds measured_skill_score in the task-time model (USP-1)
};

export type TraceFrame = { t: number; swing_deg: number; boom_deg: number; stick_deg: number; bucket_deg: number; phase: string };
export type GhostTrace = { operator_id: string; skill: string; cycle_time_s: number; frames: TraceFrame[] };

export type SiteConditions = { visibility_m: number; precip_mm: number; wind_kmh: number };
export type MachineFrame = { t: number; x: number; z: number; heading: number; swing_deg: number; boom_deg: number; stick_deg: number; bucket_deg: number; reverse: boolean };
export type PersonFrame = { t: number; id: string; x: number; z: number };

/** USP-2: a replayable near-miss DRAFT captured by the simulator. */
export type NearMissData = {
  id: string;
  trigger: "red_zone_during_swing" | "red_zone_during_reverse" | "belt_off_travel" | string;
  caption: string;
  worker: string;
  closest_m: number;
  closest_t: number;
  red_radius_m: number;
  conditions: SiteConditions;
  machine: MachineFrame[];
  people: PersonFrame[];
};

/** USP-3: one-tap idle reason. `corroborated` is silent — never show it to the operator (Rule 3). */
export type IdleTag = {
  reason: "truck_wait" | "warmup" | "break" | "other";
  idle_s: number;
  truck_present: boolean;
  corroborated: boolean;
  scenario: string;
};

export type ScenarioResult = { scenario: string; near_miss_id: string; trigger: string; passed: boolean; reason: string };

/** Sent by Unity after every scenario load: which feature switches are ON (deny by default). */
export type ScenarioState = {
  scenario: string;
  ghost: boolean;
  zones: boolean;
  workers: boolean;
  nearMiss: boolean;
  replay: boolean;
  weather: boolean;
  idleChips: boolean;
  checkin: boolean;
  idlePenalty: boolean;
  conditions: SiteConditions;
};

export type SimMessage =
  | { source: "unity-sim"; type: "ready"; data: Record<string, never> }
  | { source: "unity-sim"; type: "event"; data: SimEvent }
  | { source: "unity-sim"; type: "status"; data: SimStatus }
  | { source: "unity-sim"; type: "ghost_score"; data: GhostScore }
  | { source: "unity-sim"; type: "ghost_trace"; data: GhostTrace }
  | { source: "unity-sim"; type: "near_miss"; data: NearMissData }
  | { source: "unity-sim"; type: "idle_tag"; data: IdleTag }
  | { source: "unity-sim"; type: "scenario_result"; data: ScenarioResult }
  | { source: "unity-sim"; type: "scenario_loaded"; data: ScenarioState };

const MESSAGE_TYPES: readonly string[] = ["ready", "event", "status", "ghost_score", "ghost_trace", "near_miss", "idle_tag", "scenario_result", "scenario_loaded"];

export function parseSimMessage(raw: unknown): SimMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as { source?: unknown; type?: unknown };
  if (m.source !== "unity-sim" || typeof m.type !== "string" || !MESSAGE_TYPES.includes(m.type)) return null;
  return raw as SimMessage;
}

// ---------- app → Unity ----------
export type SimCommand = { object: "Excavator" | "Ghost" | "ScenarioManager"; method: string; arg: string };

export const SCENARIOS = ["Free", "GhostOperator", "TrenchNearWorkers", "LoadingInRain", "IdleDiscipline", "NearMissReplay", "WelfareCheck"] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

export function toScenario(value: string | undefined): ScenarioName {
  return (SCENARIOS as readonly string[]).includes(value ?? "") ? (value as ScenarioName) : "Free";
}

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
  setConditions: (c: SiteConditions): SimCommand => ({ object: "Excavator", method: "SetConditions", arg: JSON.stringify(c) }),
  loadGhostTrace: (trace: GhostTrace): SimCommand => ({ object: "Ghost", method: "LoadTrace", arg: JSON.stringify(trace) }),
  loadScenario: (scenario: ScenarioName, opts?: { conditions?: SiteConditions; nearMiss?: NearMissData }): SimCommand => ({
    object: "ScenarioManager",
    method: "LoadScenario",
    arg: JSON.stringify({ scenario, hasConditions: Boolean(opts?.conditions), conditions: opts?.conditions, nearMiss: opts?.nearMiss }),
  }),
};

// ---------- component contract (shared by UnitySim.tsx and UnitySim.web.tsx) ----------
export type UnitySimHandle = { send: (cmd: SimCommand) => void };
export type UnitySimProps = { onMessage: (msg: SimMessage) => void };

// ---------- near-miss drafts kept for this session (TODO: persist to incidents + outbox) ----------
const nearMissDrafts: NearMissData[] = [];
export function saveNearMissDraft(nm: NearMissData): void {
  nearMissDrafts.unshift(nm);
  if (nearMissDrafts.length > 20) nearMissDrafts.pop();
}
export function getNearMissDrafts(): NearMissData[] {
  return [...nearMissDrafts];
}
export function latestNearMissDraft(): NearMissData | undefined {
  return nearMissDrafts[0];
}

// Seed telemetry (CLAUDE.md §1) as sim rows. idlePct from engine-hour deltas; first row has no prior reading.
export const SEED_TELEMETRY_ROWS: TelemetryRow[] = [
  { time: "2025-05-01 08:00", engineOn: true, seatbelt: true, loadCycles: 12, idlePct: 0 },
  { time: "2025-05-01 10:00", engineOn: true, seatbelt: false, loadCycles: 2, idlePct: 70 },
  { time: "2025-05-01 14:00", engineOn: true, seatbelt: true, loadCycles: 10, idlePct: 15 },
  { time: "2025-05-02 09:00", engineOn: true, seatbelt: false, loadCycles: 1, idlePct: 27 },
];