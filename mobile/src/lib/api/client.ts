/**
 * Thin fetch wrapper against the real FastAPI backend — CLAUDE.md section 3. This is
 * the "online" half of the offline-first contract; lib/sync (not yet built) will add
 * the outbox/retry machinery on top for Phase 4's full offline-first scope. For now
 * this proves the mobile app really talks to the real API rather than mock data only.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const DEMO_USERNAME = "demo_op1001";
const DEMO_PASSWORD = "demo12345";
const DEMO_OPERATOR_ID = "OP1001";
export const DEMO_MACHINE_ID = "EXC001";
const DEMO_SUPERVISOR_USERNAME = "demo_supervisor1";
const DEMO_SUPERVISOR_PASSWORD = "demo12345";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(`POST ${path} failed`, res.status);
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(`GET ${path} failed`, res.status);
  return res.json() as Promise<T>;
}

async function postJsonAuthed<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(`POST ${path} failed`, res.status);
  return res.json() as Promise<T>;
}

type TokenResponse = { access_token: string; role: string; operator_id: string | null };

/** Logs in as the demo operator, registering the account on first run. Stands in for
 * a real login screen, which is out of scope for the current timeline. */
export async function ensureDemoSession(): Promise<{ token: string; operatorId: string }> {
  try {
    const login = await postJson<TokenResponse>("/auth/login", {
      username: DEMO_USERNAME,
      password: DEMO_PASSWORD,
    });
    return { token: login.access_token, operatorId: login.operator_id ?? DEMO_OPERATOR_ID };
  } catch {
    const registered = await postJson<TokenResponse>("/auth/register", {
      username: DEMO_USERNAME,
      password: DEMO_PASSWORD,
      role: "operator",
      operator_id: DEMO_OPERATOR_ID,
    });
    return { token: registered.access_token, operatorId: registered.operator_id ?? DEMO_OPERATOR_ID };
  }
}

/** Logs in as a demo supervisor account, registering it on first run — stands in for a
 * real login/role-switch screen, same simplification as ensureDemoSession(). */
export async function ensureDemoSupervisorSession(): Promise<{ token: string }> {
  try {
    const login = await postJson<TokenResponse>("/auth/login", {
      username: DEMO_SUPERVISOR_USERNAME,
      password: DEMO_SUPERVISOR_PASSWORD,
    });
    return { token: login.access_token };
  } catch {
    const registered = await postJson<TokenResponse>("/auth/register", {
      username: DEMO_SUPERVISOR_USERNAME,
      password: DEMO_SUPERVISOR_PASSWORD,
      role: "supervisor",
    });
    return { token: registered.access_token };
  }
}

export type ApiTask = {
  task_id: string;
  task_type: string;
  status: string;
  est_min: number;
  p50_min: number | null;
  p90_min: number | null;
  weather_condition: string | null;
  risk_band: string | null;
  machine_id: string;
  version: number;
  conflict: boolean;
};

export async function fetchTasksToday(token: string): Promise<ApiTask[]> {
  return getJson<ApiTask[]>("/tasks/today", token);
}

// Assistant — backend/app/api/assistant.py. Mirrors app/schemas/assistant.py exactly.
export type AssistantAction = { type: string; payload: Record<string, unknown> };

export type AssistantChatResponse = {
  reply: string;
  intent: string;
  language: string;
  source: "llm" | "grounded" | "degraded_no_key";
  actions: AssistantAction[];
};

export async function postAssistantChat(
  token: string,
  body: { message: string; language?: string; task_id?: string }
): Promise<AssistantChatResponse> {
  return postJsonAuthed<AssistantChatResponse>("/assistant/chat", token, body);
}

export type IncidentReportResponse = {
  incident_id: string;
  type: string;
  severity: string;
  is_near_miss: boolean;
  trigger: string;
  summary: string;
  confidence: number;
  source: "llm" | "heuristic";
};

export async function postIncidentReport(
  token: string,
  body: { transcript: string; machine_id: string; language?: string }
): Promise<IncidentReportResponse> {
  return postJsonAuthed<IncidentReportResponse>("/assistant/incident", token, body);
}

export type BookingResponse = {
  booking_id: number;
  slot_start: string;
  slot_end: string;
  status: string;
  reply: string;
  source: "llm" | "grounded" | "degraded_no_key";
};

export async function postBookingRequest(
  token: string,
  body: { message: string; language?: string }
): Promise<BookingResponse> {
  return postJsonAuthed<BookingResponse>("/assistant/booking", token, body);
}

// Supervisor — backend/app/api/supervisor.py + /nearmiss/hotspots + /incidents. CLAUDE.md
// §2.1 Rule 2: this data is already server-side aggregated/anonymized, not per-operator.
export type SupervisorOverview = {
  today_task_status: Record<string, number>;
  tasks_with_conflict: number;
  unconfirmed_near_misses: number;
};

export async function fetchSupervisorOverview(token: string): Promise<SupervisorOverview> {
  return getJson<SupervisorOverview>("/supervisor/overview", token);
}

export type NearMissHotspots = {
  total_near_misses: number;
  by_machine: Record<string, number>;
  by_hour: Record<string, number>;
  by_sector: Record<string, number>;
  by_condition: Record<string, number>;
  by_machine_class: Record<string, number>;
  worst_hour: number;
  worst_sector: string;
  worst_condition: string;
};

export async function fetchNearMissHotspots(token: string): Promise<NearMissHotspots | null> {
  const result = await getJson<Partial<NearMissHotspots>>("/nearmiss/hotspots", token);
  return typeof result.total_near_misses === "number" ? (result as NearMissHotspots) : null;
}

export type ApiIncident = {
  id: string;
  ts: string;
  machine_id: string;
  operator_id: string | null; // null unless the operator themself confirmed it (Rule 2)
  type: string;
  severity: string;
  is_near_miss: boolean;
  trigger: string;
  confirmed: boolean;
};

export async function fetchIncidents(token: string): Promise<ApiIncident[]> {
  return getJson<ApiIncident[]>("/incidents", token);
}

// Sync — backend/app/api/sync.py. This calls /sync/push directly for a single event
// rather than through a real outbox (WatermelonDB + retry/backoff is Phase 4, not yet
// built — see README "known gaps"); it's a real, idempotent push of one event, just
// without the offline queueing that makes it survive a dropped connection.
export type SyncEvent = {
  event_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  device_id: string;
  attempt: number;
};

export async function pushSyncEvents(token: string, events: SyncEvent[]): Promise<{ acked: string[] }> {
  return postJsonAuthed<{ acked: string[] }>("/sync/push", token, { events });
}

export type SyncPullTask = {
  task_id: string;
  operator_id: string;
  machine_id: string;
  task_type: string;
  status: string;
  est_min: number;
  p50_min: number | null;
  p90_min: number | null;
  version: number;
  conflict: boolean;
};

export type SyncPullResponse = {
  cursor: string;
  tasks: SyncPullTask[];
  bookings: unknown[];
  training_assignments: unknown[];
  model_bundle: { version: string; published_at: string } | null;
};

export async function fetchSyncPull(token: string, since: string | null): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return getJson<SyncPullResponse>(`/sync/pull${query}`, token);
}
