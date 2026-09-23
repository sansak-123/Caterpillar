/**
 * On-device mirror of backend/app/rules/live.py's proximity-zone formula — CLAUDE.md
 * USP-4 (condition-adaptive safety envelope) and section 6 `proximity`. Must stay
 * numerically identical to the Python side so a red alert never disagrees between the
 * device (which fires it) and the server (which analyzes it later).
 */

export type MachineClass = "excavator" | "wheel_loader" | "dozer";
export type Zone = "red" | "amber" | "green";

const BASE_RADIUS_M: Record<MachineClass, number> = {
  excavator: 12.0,
  wheel_loader: 10.0,
  dozer: 14.0,
};

export function conditionFactor(visibilityM: number | null, precipMm: number, windKmh: number): number {
  let factor = 1.0;
  if (visibilityM !== null) {
    factor *= 1 + Math.max(0, (1000 - visibilityM) / 2000);
  }
  factor *= 1 + precipMm / 50;
  factor *= 1 + windKmh / 100;
  return factor;
}

export type ProximityZones = { redM: number; amberM: number };

export function proximityZones(
  machineClass: MachineClass,
  visibilityM: number | null,
  precipMm: number,
  windKmh: number,
  isSwinging: boolean,
  isReversing: boolean,
  isRearSector = false
): ProximityZones {
  const base = BASE_RADIUS_M[machineClass] ?? 10.0;
  const cond = conditionFactor(visibilityM, precipMm, windKmh);
  const state = isSwinging || isReversing ? 1.3 : 1.0;
  const rear = isRearSector ? 1.5 : 1.0; // rear blind spot weighted higher, ISO 5006
  const amberM = base * cond * state * rear;
  const redM = amberM * 0.4;
  return { redM, amberM };
}

export function zoneForDistance(distanceM: number, zones: ProximityZones): Zone {
  if (distanceM < zones.redM) return "red";
  if (distanceM < zones.amberM) return "amber";
  return "green";
}
