import * as fs from "fs";
import * as path from "path";

import { evaluateReading, intervalMinutes, readingSafetyAlert } from "./hourlyReading";

// CLAUDE.md section 8: "Seed row 2025-05-01 10:00 MUST trigger seatbelt + idle alerts
// in both TS and Python tests" — reads the organiser-provided CSV directly (same file
// backend/tests/test_rules_hourly.py reads) so the two suites can never silently drift
// onto different fixtures.
const SEED_PATH = path.join(__dirname, "..", "..", "..", "..", "data", "seed", "telemetry_seed.csv");

type SeedRow = {
  timestamp: string;
  machine_id: string;
  operator_id: string;
  engine_hours: string;
  fuel_used_l: string;
  load_cycles: string;
  idle_min: string;
  seatbelt_status: string;
  safety_alert: string;
};

function loadSeedRows(): SeedRow[] {
  const text = fs.readFileSync(SEED_PATH, "utf-8").trim();
  const [header, ...lines] = text.split(/\r?\n/);
  const columns = header.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row = {} as SeedRow;
    columns.forEach((col, i) => {
      (row as unknown as Record<string, string>)[col] = values[i];
    });
    return row;
  });
}

describe("telemetry_seed.csv (organiser-provided, verbatim)", () => {
  const rows = loadSeedRows();

  it("has the four expected rows in order", () => {
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.timestamp)).toEqual([
      "2025-05-01 08:00:00",
      "2025-05-01 10:00:00",
      "2025-05-01 14:00:00",
      "2025-05-02 09:00:00",
    ]);
  });

  it("the 10:00 row triggers both a seatbelt and an idle alert", () => {
    const [row0800, row1000] = rows;
    const interval = intervalMinutes(parseFloat(row1000.engine_hours), parseFloat(row0800.engine_hours));

    const result = evaluateReading(parseFloat(row1000.idle_min), row1000.seatbelt_status, interval);

    expect(interval).toBeCloseTo(78.0, 5); // 1524.8 - 1523.5 = 1.3h
    expect(result.idleAlert).toBe(true);
    expect(result.seatbeltAlert).toBe(true);
    expect(readingSafetyAlert(result)).toBe(true);
    expect(row1000.safety_alert).toBe("Yes");
  });

  it("the 08:00 row (first reading, no interval) does not trigger", () => {
    const row0800 = rows[0];
    const result = evaluateReading(parseFloat(row0800.idle_min), row0800.seatbelt_status, null);

    expect(result.idleAlert).toBe(false);
    expect(result.seatbeltAlert).toBe(false);
    expect(readingSafetyAlert(result)).toBe(false);
    expect(row0800.safety_alert).toBe("No");
  });

  it("the 14:00 row does not trigger", () => {
    const [, row1000, row1400] = rows;
    const interval = intervalMinutes(parseFloat(row1400.engine_hours), parseFloat(row1000.engine_hours));
    const result = evaluateReading(parseFloat(row1400.idle_min), row1400.seatbelt_status, interval);

    expect(result.idleAlert).toBe(false);
    expect(result.seatbeltAlert).toBe(false);
    expect(readingSafetyAlert(result)).toBe(false);
    expect(row1400.safety_alert).toBe("No");
  });

  it("the next-day row triggers via seatbelt even though the idle ratio is lower", () => {
    const [, , row1400, rowNext] = rows;
    const interval = intervalMinutes(parseFloat(rowNext.engine_hours), parseFloat(row1400.engine_hours));
    const result = evaluateReading(parseFloat(rowNext.idle_min), rowNext.seatbelt_status, interval);

    expect(result.seatbeltAlert).toBe(true);
    expect(readingSafetyAlert(result)).toBe(true);
    expect(rowNext.safety_alert).toBe("Yes");
  });
});
