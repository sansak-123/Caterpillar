import type { SyncPullModelBundle } from "../api/client";
import { _resetDatabaseForTests, getDatabase } from "../db/database";
import { resetMockDatabases } from "../db/testHelpers";
import { ensureModelBundleDownloaded, getCurrentModelBundle } from "./downloadManager";
import { getMockDownloadedUrls, resetMockFileSystem } from "./testHelpers";

beforeEach(() => {
  _resetDatabaseForTests();
  resetMockDatabases();
  resetMockFileSystem();
});

function makeBundle(version: string): SyncPullModelBundle {
  return {
    version,
    published_at: "2026-09-24T00:00:00",
    task_time_p50_url: `/model-bundles/${version}/files/p50`,
    task_time_p90_url: `/model-bundles/${version}/files/p90`,
    feature_schema: { features: ["task_type", "weather"] },
    thresholds: { idle_ratio_alert_threshold: 0.6 },
  };
}

describe("ensureModelBundleDownloaded", () => {
  it("downloads both artifacts and records the bundle as current", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));

    expect(getMockDownloadedUrls()).toEqual([
      "http://localhost:8000/model-bundles/v1/files/p50",
      "http://localhost:8000/model-bundles/v1/files/p90",
    ]);

    const current = await getCurrentModelBundle();
    expect(current?.version).toBe("v1");
    expect(current?.is_current).toBe(1);
    expect(JSON.parse(current!.feature_schema_json)).toEqual({ features: ["task_type", "weather"] });
  });

  it("does not re-download a version that's already on disk", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));

    expect(getMockDownloadedUrls()).toHaveLength(2); // still just the first call's two files
  });

  it("switches `is_current` to a newly-downloaded version without duplicating rows", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));
    await ensureModelBundleDownloaded("tok", makeBundle("v2"));

    const db = await getDatabase();
    const rows = await db.getAllAsync<{ version: string; is_current: number }>(
      "SELECT version, is_current FROM model_bundles ORDER BY version"
    );
    expect(rows).toEqual([
      { version: "v1", is_current: 0 },
      { version: "v2", is_current: 1 },
    ]);
  });

  it("re-activating an older, already-downloaded version flips is_current back without re-downloading", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));
    await ensureModelBundleDownloaded("tok", makeBundle("v2"));
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));

    expect(getMockDownloadedUrls()).toHaveLength(4); // no third download round

    const db = await getDatabase();
    const rows = await db.getAllAsync<{ version: string; is_current: number }>(
      "SELECT version, is_current FROM model_bundles ORDER BY version"
    );
    expect(rows).toEqual([
      { version: "v1", is_current: 1 },
      { version: "v2", is_current: 0 },
    ]);
  });
});
