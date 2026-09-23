import { getDatabase } from "../db/database";
import { appendToOutbox } from "../sync/outbox";

const RETENTION_MS = 24 * 60 * 60 * 1000; // CLAUDE.md §3.1: "1 Hz raw stays on device for 24 h"

export type TelemetryFrame = {
  ts: string;
  machine_id: string;
  operator_id?: string | null;
  engine_on?: boolean;
  state?: string | null;
  seatbelt?: string | null;
  swing_rate_dps?: number | null;
  travel_kmh?: number | null;
  reverse?: boolean;
  fuel_rate_lph?: number | null;
  nearest_person_m?: number | null;
  zone?: string | null;
};

// The raw shape a row comes back as from SQLite — booleans are stored/read as 0/1
// integers, unlike TelemetryFrame's boolean fields on the way in.
type BufferedRow = {
  ts: string;
  machine_id: string;
  operator_id: string | null;
  engine_on: number;
  state: string | null;
  seatbelt: string | null;
  swing_rate_dps: number | null;
  travel_kmh: number | null;
  reverse: number;
  fuel_rate_lph: number | null;
  nearest_person_m: number | null;
  zone: string | null;
};

export async function insertFrame(frame: TelemetryFrame): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO telemetry_buffer
       (ts, machine_id, operator_id, engine_on, state, seatbelt, swing_rate_dps, travel_kmh, reverse, fuel_rate_lph, nearest_person_m, zone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      frame.ts,
      frame.machine_id,
      frame.operator_id ?? null,
      frame.engine_on ? 1 : 0,
      frame.state ?? null,
      frame.seatbelt ?? null,
      frame.swing_rate_dps ?? null,
      frame.travel_kmh ?? null,
      frame.reverse ? 1 : 0,
      frame.fuel_rate_lph ?? null,
      frame.nearest_person_m ?? null,
      frame.zone ?? null,
    ]
  );
}

export async function pruneOldTelemetry(nowMs: number = Date.now()): Promise<void> {
  const db = await getDatabase();
  const cutoff = new Date(nowMs - RETENTION_MS).toISOString();
  await db.runAsync("DELETE FROM telemetry_buffer WHERE ts < ?", cutoff);
}

/** Truncates an ISO timestamp to its minute — "2026-09-24T10:15:42.123Z" -> "2026-09-24T10:15". */
export function minuteBucket(ts: string): string {
  return ts.slice(0, 16);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mostCommon<T>(values: T[], fallback: T): T {
  if (!values.length) return fallback;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

const ZONE_SEVERITY: Record<string, number> = { green: 0, amber: 1, red: 2 };

/** A minute's aggregate reports its WORST zone, not its most common one — averaging a
 * single red-zone spike away into "mostly green" would bury exactly the safety-relevant
 * signal a 1-min summary exists to preserve. */
function worstZone(zones: string[]): string {
  if (!zones.length) return "green";
  return zones.reduce((worst, z) => ((ZONE_SEVERITY[z] ?? 0) > (ZONE_SEVERITY[worst] ?? 0) ? z : worst), zones[0]);
}

/**
 * CLAUDE.md §3.1: "builds 1-min aggregates into outbox." Reads every buffered frame for
 * one already-completed minute and queues a single summary event — never raw frames —
 * through the same outbox every other offline-capable write uses. Returns false if
 * there was nothing buffered for that minute (e.g. the app was closed through it).
 */
export async function aggregateAndQueueMinute(machineId: string, minuteBucketKey: string): Promise<boolean> {
  const db = await getDatabase();
  const frames = await db.getAllAsync<BufferedRow>(
    "SELECT * FROM telemetry_buffer WHERE machine_id = ? AND substr(ts, 1, 16) = ? ORDER BY ts",
    [machineId, minuteBucketKey]
  );
  if (frames.length === 0) return false;

  const last = frames[frames.length - 1];
  await appendToOutbox("telemetry_minute", {
    ts: `${minuteBucketKey}:00.000Z`,
    machine_id: machineId,
    operator_id: last.operator_id ?? null,
    engine_on: Boolean(last.engine_on),
    state: mostCommon(
      frames.map((f) => f.state).filter((v): v is string => v != null),
      "unknown"
    ),
    seatbelt: last.seatbelt ?? "Fastened",
    swing_rate_dps: average(frames.map((f) => f.swing_rate_dps ?? 0)),
    travel_kmh: average(frames.map((f) => f.travel_kmh ?? 0)),
    reverse: Boolean(last.reverse),
    fuel_rate_lph: average(frames.map((f) => f.fuel_rate_lph ?? 0)),
    nearest_person_m: last.nearest_person_m ?? null,
    zone: worstZone(frames.map((f) => f.zone).filter((v): v is string => v != null)),
  });
  return true;
}
