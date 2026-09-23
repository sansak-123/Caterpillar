import { proximityZones, zoneForDistance } from "./proximity";

describe("proximityZones", () => {
  it("widens in poor visibility/rain/wind", () => {
    const clear = proximityZones("excavator", 10000, 0, 5, false, false);
    const poor = proximityZones("excavator", 500, 10, 30, false, false);
    expect(poor.amberM).toBeGreaterThan(clear.amberM);
    expect(poor.redM).toBeGreaterThan(clear.redM);
  });

  it("widens while swinging", () => {
    const still = proximityZones("excavator", 10000, 0, 5, false, false);
    const swinging = proximityZones("excavator", 10000, 0, 5, true, false);
    expect(swinging.amberM).toBeGreaterThan(still.amberM);
  });

  it("weights the rear sector higher than the same conditions front-on", () => {
    const front = proximityZones("excavator", 10000, 0, 5, false, false, false);
    const rear = proximityZones("excavator", 10000, 0, 5, false, false, true);
    expect(rear.amberM).toBeGreaterThan(front.amberM);
  });
});

describe("zoneForDistance", () => {
  it("classifies distances into red/amber/green", () => {
    const zones = proximityZones("excavator", 10000, 0, 5, false, false);
    expect(zoneForDistance(1.0, zones)).toBe("red");
    expect(zoneForDistance(zones.amberM + 5, zones)).toBe("green");
  });
});
