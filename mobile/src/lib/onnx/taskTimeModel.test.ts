import { InferenceSession } from "onnxruntime-react-native";

import type { SyncPullModelBundle } from "../api/client";
import { ensureModelBundleDownloaded } from "../assets/downloadManager";
import { resetMockFileSystem } from "../assets/testHelpers";
import { _resetDatabaseForTests } from "../db/database";
import { resetMockDatabases } from "../db/testHelpers";
import { resetOnnxMock } from "./testHelpers";
import { _resetSessionCacheForTests, estimateTaskTimeOffline } from "./taskTimeModel";

beforeEach(() => {
  _resetDatabaseForTests();
  resetMockDatabases();
  resetMockFileSystem();
  resetOnnxMock();
  _resetSessionCacheForTests();
});

const SCHEMA = {
  features: ["task_type", "wind_kmh", "temp_c"],
  categorical_encodings: { task_type: ["Demolition", "Earth Excavation", "Grading"] },
  boolean_columns: [],
};

function makeBundle(version: string): SyncPullModelBundle {
  return {
    version,
    published_at: "2026-09-24T00:00:00",
    task_time_p50_url: `/model-bundles/${version}/files/p50`,
    task_time_p90_url: `/model-bundles/${version}/files/p90`,
    feature_schema: SCHEMA,
    thresholds: {},
  };
}

describe("estimateTaskTimeOffline", () => {
  it("returns null when no model bundle has ever been downloaded", async () => {
    const result = await estimateTaskTimeOffline(60, { task_type: "Grading" });
    expect(result).toBeNull();
  });

  it("runs the local p50/p90 sessions and scales the ratio by est_min", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));

    // vector = [2 (Grading), 15, 31] -> sum 48 -> mock session ratio = 1 + 48/100 = 1.48
    const result = await estimateTaskTimeOffline(60, { task_type: "Grading", wind_kmh: 15, temp_c: 31 });

    expect(result).not.toBeNull();
    const expectedMin = Math.round(60 * 1.48);
    expect(result!.value).toBe(expectedMin);
    expect(result!.range).toEqual([expectedMin, expectedMin]); // same deterministic mock ratio both sessions
    expect(result!.modelVersion).toBe("v1");
    expect(result!.reasons[0]).toMatch(/approximate \(offline\)/);
  });

  it("flags approximated fields in the reasons when context is incomplete", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));

    const result = await estimateTaskTimeOffline(60, { task_type: "Grading" }); // wind_kmh, temp_c missing

    expect(result!.reasons.some((r) => r.includes("wind_kmh"))).toBe(true);
  });

  it("reuses one session per model file across repeated calls instead of recreating it", async () => {
    await ensureModelBundleDownloaded("tok", makeBundle("v1"));

    await estimateTaskTimeOffline(60, { task_type: "Grading", wind_kmh: 15, temp_c: 31 });
    await estimateTaskTimeOffline(90, { task_type: "Demolition", wind_kmh: 5, temp_c: 20 });

    expect((InferenceSession.create as jest.Mock).mock.calls.length).toBe(2); // p50 + p90, once each — not 4
  });
});
