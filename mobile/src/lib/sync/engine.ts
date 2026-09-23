import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { fetchSyncPull, pushSyncEvents, type SyncEvent as ApiSyncEvent } from "../api/client";
import { getDatabase } from "../db/database";
import { useAuthStore } from "../../store/auth";
import { useConnectivityStore } from "../../store/connectivity";
import {
  countPendingOutbox,
  getSyncCursor,
  listPendingOutbox,
  markOutboxAcked,
  markOutboxFailed,
  setSyncCursor,
} from "./outbox";

const FOREGROUND_RETRY_MS = 30_000; // CLAUDE.md §3.1: "a 30 s retry loop ... while foregrounded"
const MAX_BACKOFF_MS = 5 * 60_000; // "exponential backoff (max 5 min)"

function backoffDelayMs(consecutiveFailures: number): number {
  return Math.min(FOREGROUND_RETRY_MS * 2 ** Math.max(0, consecutiveFailures), MAX_BACKOFF_MS);
}

/** Pushes every pending outbox row to /sync/push, batched (server already caps at 500
 * per CLAUDE.md §3.1), and marks each row acked/failed by the server's own response —
 * never assumes success. */
export async function drainOutbox(token: string): Promise<{ attempted: number; acked: number }> {
  const pending = await listPendingOutbox(500);
  if (pending.length === 0) return { attempted: 0, acked: 0 };

  const events: ApiSyncEvent[] = pending.map((row) => ({
    event_id: row.event_id,
    type: row.type,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    created_at: row.created_at,
    device_id: row.device_id,
    attempt: row.attempt + 1,
  }));

  try {
    const result = await pushSyncEvents(token, events);
    const ackedSet = new Set(result.acked);
    await markOutboxAcked(result.acked);
    const failedIds = events.map((e) => e.event_id).filter((id) => !ackedSet.has(id));
    await markOutboxFailed(failedIds);
    return { attempted: events.length, acked: result.acked.length };
  } catch {
    await markOutboxFailed(events.map((e) => e.event_id));
    return { attempted: events.length, acked: 0 };
  }
}

/** Pulls tasks (and, later, bookings/training assignments) since the last cursor and
 * upserts them into the local `tasks` table — CLAUDE.md §3.1 pull contract. */
export async function pullFromServer(token: string): Promise<void> {
  const cursor = await getSyncCursor();
  const result = await fetchSyncPull(token, cursor);
  const db = await getDatabase();
  for (const t of result.tasks) {
    await db.runAsync(
      `INSERT INTO tasks (task_id, task_type, status, est_min, p50_min, p90_min, actual_min, weather_condition, risk_band, machine_id, version, conflict, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)
       ON CONFLICT(task_id) DO UPDATE SET
         task_type = excluded.task_type,
         status = excluded.status,
         est_min = excluded.est_min,
         p50_min = excluded.p50_min,
         p90_min = excluded.p90_min,
         machine_id = excluded.machine_id,
         version = excluded.version,
         conflict = excluded.conflict,
         updated_at = excluded.updated_at`,
      [
        t.task_id,
        t.task_type,
        t.status,
        t.est_min,
        t.p50_min,
        t.p90_min,
        t.machine_id,
        t.version,
        t.conflict ? 1 : 0,
        new Date().toISOString(),
      ]
    );
  }
  await setSyncCursor(result.cursor);
}

async function runSyncCycle(token: string): Promise<boolean> {
  const drain = await drainOutbox(token);
  await pullFromServer(token);
  return drain.attempted === drain.acked;
}

/**
 * Drives the whole offline/online contract from one place: reacts to real connectivity
 * changes (NetInfo), retries every 30s while foregrounded with exponential backoff on
 * failure (capped at 5 min), and refreshes the connectivity store's queued count from
 * the real outbox table (not a guess). Mount once near the app root — CLAUDE.md §3.1.
 *
 * `expo-task-manager`/`expo-background-fetch` background registration is written below
 * for real, but neither works on web nor in Expo Go (Expo's own docs: web always
 * reports unavailable, native needs a custom dev client) — this dev environment can't
 * verify that half beyond "it doesn't throw," so the foreground loop above is the part
 * actually proven to work here.
 */
export function useSyncEngine(): void {
  const token = useAuthStore((s) => s.token);
  const devNetworkCut = useConnectivityStore((s) => s.devNetworkCut);
  const setStatus = useConnectivityStore((s) => s.setStatus);
  const setQueuedCount = useConnectivityStore((s) => s.setQueuedCount);
  const markSynced = useConnectivityStore((s) => s.markSynced);
  const failureCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshQueuedCount() {
      const count = await countPendingOutbox();
      if (!cancelled) setQueuedCount(count);
    }

    async function tick() {
      // The retry timer, the NetInfo listener, and the AppState listener can all try
      // to fire around the same reconnect moment — without this guard, two overlapping
      // ticks would each read the same still-pending outbox rows and push the same
      // event_id twice concurrently (a real race this caught: see the SAVEPOINT fix in
      // backend/app/api/sync.py).
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await refreshQueuedCount();
        if (devNetworkCut || !token) {
          setStatus(devNetworkCut ? "offline" : "online");
          return;
        }
        setStatus("syncing");
        try {
          const clean = await runSyncCycle(token);
          if (!cancelled) {
            await refreshQueuedCount();
            setStatus("online");
            markSynced();
            failureCount.current = clean ? 0 : failureCount.current + 1;
          }
        } catch {
          if (!cancelled) {
            setStatus("offline");
            failureCount.current += 1;
          }
        }
      } finally {
        inFlightRef.current = false;
        scheduleNext();
      }
    }

    function scheduleNext() {
      if (cancelled) return;
      const delay = failureCount.current > 0 ? backoffDelayMs(failureCount.current) : FOREGROUND_RETRY_MS;
      timerRef.current = setTimeout(tick, delay);
    }

    tick();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !devNetworkCut) {
        // Connectivity just came back — don't wait for the backoff timer.
        if (timerRef.current) clearTimeout(timerRef.current);
        failureCount.current = 0;
        tick();
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        if (timerRef.current) clearTimeout(timerRef.current);
        tick();
      }
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      netInfoUnsubscribe();
      appStateSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, devNetworkCut]);

  useEffect(() => {
    if (Platform.OS === "web") return; // TaskManager is unconditionally unavailable on web
    registerBackgroundSync().catch(() => {
      // Best-effort — falls back to the foreground loop above.
    });
  }, []);
}

const BACKGROUND_SYNC_TASK = "operatoros-background-sync";

async function registerBackgroundSync(): Promise<void> {
  // Deferred imports: these native modules don't resolve meaningfully on web, and this
  // function is already skipped there — deferring avoids Metro trying to evaluate their
  // native bindings at module-init time on a platform that doesn't have them.
  const TaskManager = await import("expo-task-manager");
  const BackgroundFetch = await import("expo-background-fetch");

  if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
    TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
      const token = useAuthStore.getState().token;
      if (!token) return BackgroundFetch.BackgroundFetchResult.NoData;
      try {
        const drain = await drainOutbox(token);
        await pullFromServer(token);
        return drain.attempted > 0
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60, // seconds — OS treats this as a floor, not a guarantee
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
