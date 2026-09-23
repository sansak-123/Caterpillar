/**
 * Slope / rollover stability — CLAUDE.md USP-6 / section 6 `slope_alert`.
 * `slopePct` already exists in telemetry_1min but was unused for safety. The base
 * safe-operating threshold is a documented assumption sitting well under ISO 3471
 * ROPS static-stability test angles (which certify survivability in a rollover, not
 * a safe *working* angle) — a working machine should never approach the tested tip
 * angle in the first place. The threshold tightens on soft/wet ground or heavy load.
 */

export type SlopeLevel = "ok" | "caution" | "danger";

export type SlopeResult = {
  level: SlopeLevel;
  safeLimitPct: number;
  dangerLimitPct: number;
};

const BASE_SAFE_LIMIT_PCT = 25; // ~14 degrees — documented assumption, see data/calibration.md
const WET_GROUND_MOISTURE_THRESHOLD = 60;
const WET_GROUND_PENALTY_PCT = 8;
const HEAVY_PAYLOAD_KG = 1000;
const HEAVY_PAYLOAD_PENALTY_PCT = 5;
const DANGER_MARGIN_PCT = 10;

export function slopeAlert(slopePct: number, groundMoisturePct: number, payloadKg: number): SlopeResult {
  let safeLimit = BASE_SAFE_LIMIT_PCT;
  if (groundMoisturePct > WET_GROUND_MOISTURE_THRESHOLD) safeLimit -= WET_GROUND_PENALTY_PCT;
  if (payloadKg > HEAVY_PAYLOAD_KG) safeLimit -= HEAVY_PAYLOAD_PENALTY_PCT;
  safeLimit = Math.max(safeLimit, 8);

  const dangerLimit = safeLimit + DANGER_MARGIN_PCT;

  let level: SlopeLevel = "ok";
  if (slopePct >= dangerLimit) level = "danger";
  else if (slopePct >= safeLimit) level = "caution";

  return { level, safeLimitPct: safeLimit, dangerLimitPct: dangerLimit };
}
