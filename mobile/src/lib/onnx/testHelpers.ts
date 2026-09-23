import * as Ort from "onnxruntime-react-native";

/** Same pattern as lib/assets/testHelpers.ts — the real onnxruntime-react-native has no
 * `_resetOnnxMock` export; it only exists on the Jest manual mock. */
type MockableOrt = typeof Ort & { _resetOnnxMock?: () => void };

export function resetOnnxMock(): void {
  (Ort as MockableOrt)._resetOnnxMock?.();
}
