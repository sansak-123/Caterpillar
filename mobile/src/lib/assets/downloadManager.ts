import { Directory, File, Paths } from "expo-file-system";

import { API_URL, type SyncPullModelBundle } from "../api/client";
import { getDatabase } from "../db/database";
import type { LocalModelBundleRow } from "../db/schema";

const BUNDLES_DIR_NAME = "model-bundles";

function bundleDirectory(version: string): Directory {
  return new Directory(Paths.document, BUNDLES_DIR_NAME, version);
}

export async function getCurrentModelBundle(): Promise<LocalModelBundleRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalModelBundleRow>(
    "SELECT * FROM model_bundles WHERE is_current = 1 ORDER BY downloaded_at DESC LIMIT 1"
  );
}

/**
 * CLAUDE.md §3.1: "Device downloads when online via expo-file-system ... tracked in
 * WatermelonDB/SQLite" — this is that explicit download-and-track step (there's no
 * service worker on native to cache it implicitly). Called after every successful
 * /sync/pull; it's a cheap no-op once this exact version is already on disk, so it's
 * safe to call unconditionally rather than needing its own separate trigger.
 */
export async function ensureModelBundleDownloaded(
  token: string,
  bundle: SyncPullModelBundle
): Promise<LocalModelBundleRow> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<LocalModelBundleRow>(
    "SELECT * FROM model_bundles WHERE version = ?",
    [bundle.version]
  );
  if (existing) {
    if (!existing.is_current) {
      await db.runAsync("UPDATE model_bundles SET is_current = 0");
      await db.runAsync("UPDATE model_bundles SET is_current = 1 WHERE version = ?", [bundle.version]);
    }
    return existing;
  }

  const dir = bundleDirectory(bundle.version);
  if (!dir.exists) dir.create();

  const headers = { Authorization: `Bearer ${token}` };
  const p50File = await File.downloadFileAsync(
    `${API_URL}${bundle.task_time_p50_url}`,
    new File(dir, "task_time_p50.onnx"),
    { headers, idempotent: true }
  );
  const p90File = await File.downloadFileAsync(
    `${API_URL}${bundle.task_time_p90_url}`,
    new File(dir, "task_time_p90.onnx"),
    { headers, idempotent: true }
  );

  const row: LocalModelBundleRow = {
    version: bundle.version,
    p50_local_uri: p50File.uri,
    p90_local_uri: p90File.uri,
    feature_schema_json: JSON.stringify(bundle.feature_schema),
    thresholds_json: JSON.stringify(bundle.thresholds),
    downloaded_at: new Date().toISOString(),
    is_current: 1,
  };

  await db.runAsync("UPDATE model_bundles SET is_current = 0");
  await db.runAsync(
    `INSERT INTO model_bundles
       (version, p50_local_uri, p90_local_uri, feature_schema_json, thresholds_json, downloaded_at, is_current)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [row.version, row.p50_local_uri, row.p90_local_uri, row.feature_schema_json, row.thresholds_json, row.downloaded_at]
  );
  return row;
}
