import { acceptsConfirmation, isStationary } from "./inputLockout";

describe("isStationary", () => {
  it("is true below the travel/swing thresholds", () => {
    expect(isStationary(0, 0)).toBe(true);
    expect(isStationary(0.2, 1.5)).toBe(true);
  });

  it("is false once traveling or swinging past the threshold", () => {
    expect(isStationary(0.5, 0)).toBe(false);
    expect(isStationary(0, 3)).toBe(false);
  });
});

describe("acceptsConfirmation", () => {
  it("accepts a tap only while stationary", () => {
    expect(acceptsConfirmation("tap", 0, 0)).toBe(true);
    expect(acceptsConfirmation("tap", 5, 0)).toBe(false);
    expect(acceptsConfirmation("tap", 0, 10)).toBe(false);
  });

  it("always accepts voice, moving or not", () => {
    expect(acceptsConfirmation("voice", 0, 0)).toBe(true);
    expect(acceptsConfirmation("voice", 20, 15)).toBe(true);
  });
});
