import { backoffDurationMs, shouldFireLoudAlert } from "./alertBackoff";

describe("backoffDurationMs", () => {
  it("doubles per repeat, starting at 30s", () => {
    expect(backoffDurationMs(0)).toBe(30_000);
    expect(backoffDurationMs(1)).toBe(60_000);
    expect(backoffDurationMs(2)).toBe(120_000);
  });

  it("caps at 5 minutes", () => {
    expect(backoffDurationMs(10)).toBe(300_000);
  });
});

describe("shouldFireLoudAlert", () => {
  it("fires immediately the first time (no prior fire)", () => {
    expect(shouldFireLoudAlert(1_000, null, 0)).toBe(true);
  });

  it("does not re-fire within the backoff window", () => {
    expect(shouldFireLoudAlert(1_000, 0, 0)).toBe(false);
    expect(shouldFireLoudAlert(29_999, 0, 0)).toBe(false);
  });

  it("fires again once the backoff window has elapsed", () => {
    expect(shouldFireLoudAlert(30_000, 0, 0)).toBe(true);
  });

  it("uses the larger window once it has repeated", () => {
    expect(shouldFireLoudAlert(59_999, 0, 1)).toBe(false);
    expect(shouldFireLoudAlert(60_000, 0, 1)).toBe(true);
  });
});
