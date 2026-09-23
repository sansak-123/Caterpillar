import { seatbeltAlert } from "./seatbelt";

describe("seatbeltAlert", () => {
  it("fires a hard alert while traveling unfastened past 5s", () => {
    expect(seatbeltAlert(true, 8.0, 0, true, 10)).toBe("hard");
  });

  it("gives a soft reminder while idle and unfastened", () => {
    expect(seatbeltAlert(true, 0, 0, true, 30)).toBe("soft");
  });

  it("gives no alert when fastened", () => {
    expect(seatbeltAlert(true, 8.0, 0, false, 0)).toBeNull();
  });

  it("gives no alert when the engine is off", () => {
    expect(seatbeltAlert(false, 0, 0, true, 30)).toBeNull();
  });

  it("fires a hard alert from swinging alone, no travel", () => {
    expect(seatbeltAlert(true, 0, 6, true, 10)).toBe("hard");
  });
});
