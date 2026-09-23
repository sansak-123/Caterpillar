/**
 * Manual Jest mock for the native-only onnxruntime-react-native module (no JS engine
 * to run a real ONNX graph against in Jest). The fake session's output is a plain,
 * deterministic function of the input vector — the sum of its values divided by 100,
 * offset by 1 — so tests can compute the exact expected ratio from a known feature
 * vector rather than asserting against an opaque black box.
 */

type MockTensor = { type: string; data: Float32Array | number[]; dims: readonly number[] };

class MockInferenceSession {
  readonly inputNames = ["input"];
  readonly outputNames = ["variable"];

  constructor(public readonly uri: string) {}

  async run(feeds: Record<string, MockTensor>): Promise<Record<string, { data: Float32Array }>> {
    const tensor = feeds[this.inputNames[0]];
    const values = Array.from(tensor.data as Float32Array);
    const sum = values.reduce((a, b) => a + b, 0);
    const ratio = 1 + sum / 100;
    return { [this.outputNames[0]]: { data: Float32Array.from([ratio]) } };
  }

  async release(): Promise<void> {}
}

export const InferenceSession = {
  create: jest.fn(async (uri: string) => new MockInferenceSession(uri)),
};

export class Tensor {
  constructor(
    public type: string,
    public data: Float32Array | number[],
    public dims: readonly number[] = []
  ) {}
}

export function _resetOnnxMock(): void {
  (InferenceSession.create as jest.Mock).mockClear();
}
