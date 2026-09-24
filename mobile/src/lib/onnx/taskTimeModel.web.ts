import type { TaskFeatureContext } from "./featureVector";

// Web counterpart of taskTimeModel.ts (Metro picks this file for the web platform, same
// pattern as components/UnitySim.web.tsx). onnxruntime-react-native is a native-only
// module — importing it in the browser crashes at load time ("reading 'install'") — so
// the web build has no on-device ONNX re-scoring. Returning null is the same "no bundle
// yet" signal callers already handle: they keep showing the server's estimate.
export type OfflineTaskTimeEstimate = {
  value: number;
  range: [number, number];
  reasons: string[];
  modelVersion: string;
};

export function _resetSessionCacheForTests(): void {}

export async function estimateTaskTimeOffline(
  _estMin: number,
  _context: TaskFeatureContext
): Promise<OfflineTaskTimeEstimate | null> {
  return null;
}
