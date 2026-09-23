/**
 * Operator responsiveness ("are you OK?") check — CLAUDE.md USP-6 / section 6
 * `responsiveness_check`. Engine on, seatbelt fastened, but zero control input across
 * every axis for longer than a normal idle/break window can indicate a medical event,
 * not just downtime. Deliberately never a tap-only prompt (§2.1 Rule 1 spirit extended:
 * inability to tap could be the very problem) — always voice-answerable.
 */

export type MachineMotionState = {
  engineOn: boolean;
  seatbeltFastened: boolean;
  travelKmh: number;
  swingRateDps: number;
  boomDeltaDegPerMin: number;
  stickDeltaDegPerMin: number;
  bucketDeltaDegPerMin: number;
  stationaryMinutes: number;
};

export type ResponsivenessResult = {
  shouldCheckIn: boolean;
  reason: string | null;
};

const NORMAL_IDLE_MAX_MIN = 12; // beyond a normal idle/break window without a tagged reason
const MOTION_EPSILON_DEG = 1;
const MOTION_EPSILON_KMH = 0.2;
const MOTION_EPSILON_DPS = 1;

export function responsivenessCheck(state: MachineMotionState): ResponsivenessResult {
  const noMotion =
    state.travelKmh < MOTION_EPSILON_KMH &&
    state.swingRateDps < MOTION_EPSILON_DPS &&
    Math.abs(state.boomDeltaDegPerMin) < MOTION_EPSILON_DEG &&
    Math.abs(state.stickDeltaDegPerMin) < MOTION_EPSILON_DEG &&
    Math.abs(state.bucketDeltaDegPerMin) < MOTION_EPSILON_DEG;

  const suspicious =
    state.engineOn && state.seatbeltFastened && noMotion && state.stationaryMinutes > NORMAL_IDLE_MAX_MIN;

  if (!suspicious) {
    return { shouldCheckIn: false, reason: null };
  }
  return {
    shouldCheckIn: true,
    reason: `No control input for ${state.stationaryMinutes} min with engine on and seatbelt fastened`,
  };
}
