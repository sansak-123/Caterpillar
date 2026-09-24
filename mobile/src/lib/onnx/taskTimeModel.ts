import { Platform } from "react-native";

import { getCurrentModelBundle } from "../assets/downloadManager";
import { buildFeatureVector, type FeatureSchema, type TaskFeatureContext } from "./featureVector";

// CLAUDE.md section 8: "Every ML output returns {value, range, reasons[]}."
export type OfflineTaskTimeEstimate = {
  value: number; // predicted minutes (P50)
  range: [number, number]; // [P50, P90] minutes
  reasons: string[];
  modelVersion: string;
};

// onnxruntime-react-native is native-only, same as expo-task-manager/expo-background-
// fetch elsewhere in this codebase (see engine.ts's registerBackgroundSync). A plain
// top-level `import` of it crashes the web bundle immediately at module-load time
// ("Cannot read properties of undefined (reading 'install')") — not just when a
// function actually calls it — because import statements execute unconditionally
// wherever the containing module is loaded, before any Platform.OS check could run.
// These are type-only imports (erased at compile time, no runtime cost). The real
// module is loaded via a lazy `require()` in loadOrt() rather than a dynamic
// `import()`: this project's Jest/Babel setup doesn't support a bare `import()`
// expression ("invoked without --experimental-vm-modules"), while `require()` inside a
// function body is the one form Metro, Node, and Jest's CJS transform all handle
// identically — evaluated only when that line actually runs, which is only ever
// reached after the web guard in estimateTaskTimeOffline has already returned.
type OrtModule = typeof import("onnxruntime-react-native");
type InferenceSession = import("onnxruntime-react-native").InferenceSession;

const sessionCache = new Map<string, Promise<InferenceSession>>();

function loadOrt(): OrtModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("onnxruntime-react-native");
}

// One session per local model file, reused across calls — creating a session re-reads
// and re-initializes the ONNX graph, which is wasteful to redo on every re-score.
function loadSession(uri: string): Promise<InferenceSession> {
  let session = sessionCache.get(uri);
  if (!session) {
    session = loadOrt().InferenceSession.create(uri);
    sessionCache.set(uri, session);
  }
  return session;
}

/** Test-only — same pattern as db/database.ts's `_resetDatabaseForTests`. The session
 * cache is module-level (deliberately, so it survives across calls in the running app),
 * which would otherwise leak a cached session across unrelated test cases. */
export function _resetSessionCacheForTests(): void {
  sessionCache.clear();
}

async function runRatio(session: InferenceSession, vector: Float32Array): Promise<number> {
  const { Tensor } = loadOrt();
  const inputName = session.inputNames[0];
  const feeds = { [inputName]: new Tensor("float32", vector, [1, vector.length]) };
  const results = await session.run(feeds);
  const outputName = session.outputNames[0];
  const output = results[outputName];
  return Number(output.data[0]);
}

/**
 * Re-scores a task's duration entirely on-device from the currently-downloaded model
 * bundle — CLAUDE.md §3.1: "offline re-scoring uses ONNX and marks explanation
 * 'approximate (offline)'." Returns null when no bundle has been downloaded yet (e.g.
 * never been online) or on web (no onnxruntime-react-native build exists for it, same
 * as expo-file-system's model download itself not working on web) — never throws for a
 * missing/unmapped context field, those fall back to documented neutral values in
 * buildFeatureVector instead.
 */
export async function estimateTaskTimeOffline(
  estMin: number,
  context: TaskFeatureContext
): Promise<OfflineTaskTimeEstimate | null> {
  if (Platform.OS === "web") return null;

  const bundle = await getCurrentModelBundle();
  if (!bundle) return null;

  const schema = JSON.parse(bundle.feature_schema_json) as FeatureSchema;
  const { vector, approximatedFields } = buildFeatureVector(schema, context);

  const [p50Session, p90Session] = await Promise.all([
    loadSession(bundle.p50_local_uri),
    loadSession(bundle.p90_local_uri),
  ]);
  const [p50Ratio, p90Ratio] = await Promise.all([runRatio(p50Session, vector), runRatio(p90Session, vector)]);

  const reasons = ["approximate (offline): re-scored on-device without the server's full feature snapshot"];
  if (approximatedFields.length > 0) {
    const shown = approximatedFields.slice(0, 3).join(", ");
    const more = approximatedFields.length > 3 ? `, +${approximatedFields.length - 3} more` : "";
    reasons.push(`assumed typical values for: ${shown}${more}`);
  }

  const p50Min = Math.round(estMin * p50Ratio);
  const p90Min = Math.round(estMin * p90Ratio);
  return {
    value: p50Min,
    range: [p50Min, Math.max(p50Min, p90Min)],
    reasons,
    modelVersion: bundle.version,
  };
}
