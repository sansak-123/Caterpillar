import { uuidv7 } from "uuidv7";

import { getDatabase } from "../db/database";
import type { OutboxRow } from "../db/schema";
import { useConnectivityStore } from "../../store/connectivity";

/** CLAUDE.md §3.1: "every local write that must reach the cloud appends an event
 * {event_id: uuidv7, type, payload, created_at, device_id, attempt} to `outbox`." This
 * is the one and only write path into the outbox table — every offline-capable action
 * in the app (near-miss confirm, idle tag, task status change, booking request) calls
 * this instead of hitting the network directly, so it succeeds instantly regardless of
 * connectivity and the sync engine drains it opportunistically. */

async function getOrCreateDeviceId(): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'device_id'"
  );
  if (row?.value) return row.value;
  const id = `device-${uuidv7()}`;
  await db.runAsync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('device_id', ?)", id);
  return id;
}

export async function appendToOutbox(type: string, payload: Record<string, unknown>): Promise<string> {
  const db = await getDatabase();
  const deviceId = await getOrCreateDeviceId();
  const eventId = uuidv7();
  await db.runAsync(
    "INSERT INTO outbox (event_id, type, payload_json, created_at, device_id, attempt, status) VALUES (?, ?, ?, ?, ?, 0, 'pending')",
    eventId,
    type,
    JSON.stringify(payload),
    new Date().toISOString(),
    deviceId
  );
  // The connectivity pill's queued count should reflect a new write immediately, not
  // wait for the sync engine's next tick (up to 30s away) — the whole point of showing
  // it is to prove offline writes are really being captured, not simulate it.
  useConnectivityStore.getState().setQueuedCount(await countPendingOutbox());
  return eventId;
}

export async function listPendingOutbox(limit = 500): Promise<OutboxRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<OutboxRow>(
    "SELECT * FROM outbox WHERE status IN ('pending', 'failed') ORDER BY created_at LIMIT ?",
    limit
  );
}

export async function countPendingOutbox(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM outbox WHERE status IN ('pending', 'failed')"
  );
  return row?.count ?? 0;
}

export async function markOutboxAcked(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const db = await getDatabase();
  const placeholders = eventIds.map(() => "?").join(",");
  await db.runAsync(`UPDATE outbox SET status = 'acked' WHERE event_id IN (${placeholders})`, eventIds);
}

export async function markOutboxFailed(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const db = await getDatabase();
  const placeholders = eventIds.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE outbox SET status = 'failed', attempt = attempt + 1 WHERE event_id IN (${placeholders})`,
    eventIds
  );
}

export async function getSyncCursor(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'pull_cursor'"
  );
  return row?.value ?? null;
}

export async function setSyncCursor(cursor: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('pull_cursor', ?)", cursor);
}
