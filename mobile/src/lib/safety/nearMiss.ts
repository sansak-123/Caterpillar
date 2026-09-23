/**
 * On-device mirror of backend/app/rules/live.py::near_miss_trigger — CLAUDE.md USP-2
 * (Near-Miss Autopilot). Detection runs locally so a draft is created the instant it
 * happens, with zero network dependency; confirmation is separate (see inputLockout.ts)
 * and always human-gated, per USP-2's "confirm before it counts" design.
 */

import type { Zone } from "./proximity";

export type NearMissTrigger = "red_zone_swing" | "red_zone_reverse" | "belt_off_travel" | "hard_stop_after_alert" | null;

export function nearMissTrigger(
  zone: Zone,
  isSwinging: boolean,
  isReversing: boolean,
  seatbeltUnfastened: boolean,
  travelKmh: number,
  hardStopWithin2sOfAlert = false
): NearMissTrigger {
  if (zone === "red" && isSwinging) return "red_zone_swing";
  if (zone === "red" && isReversing) return "red_zone_reverse";
  if (seatbeltUnfastened && travelKmh > 0.5) return "belt_off_travel";
  if (hardStopWithin2sOfAlert) return "hard_stop_after_alert";
  return null;
}
