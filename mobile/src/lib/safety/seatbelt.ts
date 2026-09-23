/**
 * On-device mirror of backend/app/rules/live.py::seatbelt_alert — CLAUDE.md section 6.
 * Both sides must agree on every seed row (section 8): this is what the app actually
 * evaluates locally, on-device, with zero network dependency (USP-5).
 */

export type SeatbeltAlert = "hard" | "soft" | null;

export function seatbeltAlert(
  engineOn: boolean,
  travelKmh: number,
  swingRateDps: number,
  seatbeltUnfastened: boolean,
  unfastenedDurationS: number
): SeatbeltAlert {
  if (!engineOn) return null;
  const movingOrSwinging = travelKmh > 0.5 || swingRateDps > 5;
  if (seatbeltUnfastened && movingOrSwinging && unfastenedDurationS > 5) return "hard";
  if (seatbeltUnfastened && !movingOrSwinging) return "soft";
  return null;
}
