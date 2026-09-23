import { nearMissTrigger } from "./nearMiss";

describe("nearMissTrigger", () => {
  it("fires red_zone_swing on red-zone entry while swinging", () => {
    expect(nearMissTrigger("red", true, false, false, 0)).toBe("red_zone_swing");
  });

  it("fires red_zone_reverse on red-zone entry while reversing", () => {
    expect(nearMissTrigger("red", false, true, false, 0)).toBe("red_zone_reverse");
  });

  it("fires belt_off_travel when unfastened and moving", () => {
    expect(nearMissTrigger("green", false, false, true, 8.0)).toBe("belt_off_travel");
  });

  it("fires hard_stop_after_alert when flagged", () => {
    expect(nearMissTrigger("green", false, false, false, 0, true)).toBe("hard_stop_after_alert");
  });

  it("is null when nothing unsafe is happening", () => {
    expect(nearMissTrigger("green", false, false, false, 0)).toBeNull();
  });

  it("is null in the amber zone while swinging (not red)", () => {
    expect(nearMissTrigger("amber", true, false, false, 0)).toBeNull();
  });
});
