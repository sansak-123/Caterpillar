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
