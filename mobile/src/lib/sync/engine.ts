import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { fetchSyncPull, pushSyncEvents, type SyncEvent as ApiSyncEvent } from "../api/client";
import { ensureModelBundleDownloaded } from "../assets/downloadManager";
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
const TICK_TIMEOUT_MS = 15_000; // a stuck DB/network call must never wedge the engine forever

function backoffDelayMs(consecutiveFailures: number): number {
  return Math.min(FOREGROUND_RETRY_MS * 2 ** Math.max(0, consecutiveFailures), MAX_BACKOFF_MS);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
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

  if (result.model_bundle) {
    try {
      await ensureModelBundleDownloaded(token, result.model_bundle);
    } catch (err) {
      // Best-effort — lib/onnx keeps using whatever bundle (if any) is already local.
      // Logged (not silently swallowed) since a persistently failing download is worth
      // noticing during development, even though it must never block the sync cycle.
      console.warn("[sync] model bundle download failed:", err);
    }
  }

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
  const pendingRetryRef = useRef(false);

  // Read fresh from refs inside the one long-lived tick loop below, instead of
  // closing over `token`/`devNetworkCut` from whichever render mounted it.
  //
  // This fixes a real, confirmed bug (caught live: /auth/login and /tasks/today both
  // fired correctly after login, but /sync/pull never fired, ever). Root cause: the
  // old code re-ran the whole effect — tick, listeners, and all — every time
  // token/devNetworkCut changed, but `inFlightRef` is a ref, shared across every
  // re-run. The very first tick (mounted with token=null) was still awaiting a slow
  // on-device SQLite read when login resolved a couple seconds later; the new
  // effect's tick() call landed while that guard was still held and silently bailed
  // out (the early-return happens before the try/finally, so nothing gets
  // scheduled). When the stale tick finally finished, it reset the guard but then
  // called ITS OWN scheduleNext(), which checked ITS OWN generation's `cancelled`
  // flag — already true, since the effect had already been torn down and re-created
  // — so it no-opped too. Nothing was left to ever call tick() again. Keeping a
  // single generation for the whole component lifetime removes the "which
  // generation's closure is this" mismatch entirely.
  const tokenRef = useRef(token);
  const devNetworkCutRef = useRef(devNetworkCut);
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    tokenRef.current = token;
    devNetworkCutRef.current = devNetworkCut;
    // Nudge immediately rather than waiting for the 30s timer — this is what makes a
    // fresh login or a dev "cut network" toggle take effect right away.
    tickRef.current();
  }, [token, devNetworkCut]);

  useEffect(() => {
    let cancelled = false;

    async function refreshQueuedCount() {
      const count = await countPendingOutbox();
      if (!cancelled) setQueuedCount(count);
    }

    async function tick() {
      if (cancelled) return;
      if (inFlightRef.current) {
        // Something changed (token, connectivity) while a tick was already running —
        // don't drop it, run once more as soon as the current one finishes instead of
        // waiting out the full retry delay.
        pendingRetryRef.current = true;
        return;
      }
      inFlightRef.current = true;
      try {
        try {
          await withTimeout(refreshQueuedCount(), TICK_TIMEOUT_MS, "refreshQueuedCount");
        } catch (err) {
          console.warn("[sync] refreshQueuedCount failed/timed out:", err);
        }
        const currentToken = tokenRef.current;
        const currentDevNetworkCut = devNetworkCutRef.current;
        if (currentDevNetworkCut || !currentToken) {
          setStatus(currentDevNetworkCut ? "offline" : "online");
          return;
        }
        setStatus("syncing");
        try {
          const clean = await withTimeout(runSyncCycle(currentToken), TICK_TIMEOUT_MS, "runSyncCycle");
          if (!cancelled) {
            await withTimeout(refreshQueuedCount(), TICK_TIMEOUT_MS, "refreshQueuedCount").catch(() => {});
            setStatus("online");
            markSynced();
            failureCount.current = clean ? 0 : failureCount.current + 1;
          }
        } catch (err) {
          if (!cancelled) {
            setStatus("offline");
            failureCount.current += 1;
          }
          // A sync cycle failing (or a stuck DB/network call timing out) shouldn't be a
          // silent mystery — surfaced here rather than thrown, so it never wedges the
          // retry loop itself, just gets logged for dev visibility.
          console.warn("[sync] cycle failed:", err);
        }
      } finally {
        // However the above played out — success, failure, or a timeout — this MUST
        // run, or every future tick silently no-ops forever against the guard above.
        // This is what a genuinely stuck DB/network call used to do before the
        // timeouts existed.
        inFlightRef.current = false;
        if (pendingRetryRef.current) {
          pendingRetryRef.current = false;
          tick();
        } else {
          scheduleNext();
        }
      }
    }

    function scheduleNext() {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = failureCount.current > 0 ? backoffDelayMs(failureCount.current) : FOREGROUND_RETRY_MS;
      timerRef.current = setTimeout(tick, delay);
    }

    tickRef.current = tick;
    tick();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !devNetworkCutRef.current) {
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
    // Intentionally mounted once — see the comment above the ref-syncing effect for
    // why this must NOT depend on token/devNetworkCut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
