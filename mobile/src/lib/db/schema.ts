/**
 * On-device schema — CLAUDE.md §3.1: "Device state lives in on-device SQLite via
 * WatermelonDB ... or `expo-sqlite` directly if WatermelonDB's schema migrations prove
 * heavier than needed." This project uses `expo-sqlite` directly: WatermelonDB's
 * reactive model layer buys little here since the app already has Zustand for reactive
 * state, and plain SQL is something this dev environment can actually verify end-to-end
 * (expo-sqlite has real, if alpha, web support, so the offline logic below is testable
 * in the web preview and Jest, not just asserted to work on a device no one can run here).
 *
 * Table list matches §3.1 exactly: tasks, telemetry_buffer, alerts, incidents,
 * idle_tags, training_progress, bookings, outbox, model_bundles, kb_docs — plus
 * sync_meta for the pull cursor, which the spec implies ("cursor stored in
 * WatermelonDB/SQLite") but doesn't name as its own table.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL,
  est_min REAL NOT NULL,
  p50_min REAL,
  p90_min REAL,
  actual_min REAL,
  weather_condition TEXT,
  risk_band TEXT,
  machine_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  conflict INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_buffer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  operator_id TEXT,
  engine_on INTEGER,
  state TEXT,
  seatbelt TEXT,
  swing_rate_dps REAL,
  travel_kmh REAL,
  reverse INTEGER,
  fuel_rate_lph REAL,
  nearest_person_m REAL,
  zone TEXT
);
CREATE INDEX IF NOT EXISTS idx_telemetry_buffer_ts ON telemetry_buffer(ts);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT,
  acknowledged INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY NOT NULL,
  ts TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  is_near_miss INTEGER NOT NULL DEFAULT 1,
  trigger_reason TEXT,
  confirmed INTEGER NOT NULL DEFAULT 0,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS idle_tags (
  window_id TEXT PRIMARY KEY NOT NULL,
  machine_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  ts_start TEXT NOT NULL,
  ts_end TEXT NOT NULL,
  duration_min REAL NOT NULL,
  reason TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS training_progress (
  id TEXT PRIMARY KEY NOT NULL,
  scenario TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  created_offline INTEGER NOT NULL DEFAULT 0,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outbox (
  event_id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);

CREATE TABLE IF NOT EXISTS model_bundles (
  version TEXT PRIMARY KEY NOT NULL,
  p50_local_uri TEXT NOT NULL,
  p90_local_uri TEXT NOT NULL,
  feature_schema_json TEXT NOT NULL,
  thresholds_json TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kb_docs (
  id TEXT PRIMARY KEY NOT NULL,
  local_uri TEXT NOT NULL,
  version TEXT,
  downloaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
`;

export type OutboxStatus = "pending" | "syncing" | "acked" | "failed";

export type OutboxRow = {
  event_id: string;
  type: string;
  payload_json: string;
  created_at: string;
  device_id: string;
  attempt: number;
  status: OutboxStatus;
};

export type LocalIncidentRow = {
  id: string;
  ts: string;
  machine_id: string;
  operator_id: string;
  type: string;
  severity: string;
  is_near_miss: number;
  trigger_reason: string | null;
  confirmed: number;
  synced: number;
};

export type LocalIdleTagRow = {
  window_id: string;
  machine_id: string;
  operator_id: string;
  ts_start: string;
  ts_end: string;
  duration_min: number;
  reason: string;
  synced: number;
};

export type LocalTaskRow = {
  task_id: string;
  task_type: string;
  status: string;
  est_min: number;
  p50_min: number | null;
  p90_min: number | null;
  actual_min: number | null;
  weather_condition: string | null;
  risk_band: string | null;
  machine_id: string | null;
  version: number;
  conflict: number;
  updated_at: string;
};

export type LocalModelBundleRow = {
  version: string;
  p50_local_uri: string;
  p90_local_uri: string;
  feature_schema_json: string;
  thresholds_json: string;
  downloaded_at: string;
  is_current: number;
};
