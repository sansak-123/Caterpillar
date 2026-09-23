/**
 * On-device mirror of backend/app/rules/hourly.py — the hour-meter-reading style
 * evaluation the organiser's telemetry_seed.csv is shaped for. CLAUDE.md section 8 is
 * explicit: "Seed row 2025-05-01 10:00 MUST trigger seatbelt + idle alerts in both TS
 * and Python tests" — this file (and its .test.ts) is what makes that true on-device,
 * not just on the server. `idle_min` is idle minutes *since the previous reading*
 * (the engine-hours delta), not a fixed clock-hour — the 10:00 row's ~70% idle figure
 * only comes out right when divided by the 78-minute interval, not by 60.
 */

export const IDLE_RATIO_THRESHOLD = 0.6;
export const IDLE_MIN_FALLBACK_THRESHOLD = 45; // used when there's no previous reading to derive an interval

export type ReadingAlert = {
  idleAlert: boolean;
  seatbeltAlert: boolean;
};

export function readingSafetyAlert(result: ReadingAlert): boolean {
  return result.idleAlert || result.seatbeltAlert;
}

export function idleAlert(idleMin: number, intervalMin: number | null): boolean {
  if (intervalMin && intervalMin > 0) {
    return idleMin / intervalMin >= IDLE_RATIO_THRESHOLD;
  }
  return idleMin >= IDLE_MIN_FALLBACK_THRESHOLD;
}

export function hourlySeatbeltAlert(seatbeltStatus: string): boolean {
  return seatbeltStatus === "Unfastened";
}

export function evaluateReading(idleMin: number, seatbeltStatus: string, intervalMin: number | null): ReadingAlert {
  return {
    idleAlert: idleAlert(idleMin, intervalMin),
    seatbeltAlert: hourlySeatbeltAlert(seatbeltStatus),
  };
}

export function intervalMinutes(engineHours: number, previousEngineHours: number | null): number | null {
  if (previousEngineHours === null) return null;
  return (engineHours - previousEngineHours) * 60;
}
