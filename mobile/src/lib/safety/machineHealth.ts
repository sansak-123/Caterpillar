/**
 * Machine health as a safety signal — CLAUDE.md USP-6 / section 6
 * `machine_health_alert`. Reads fields that already exist in telemetry_1min but
 * previously only fed the task-time maintenance-debt multiplier. Thresholds are
 * documented assumptions centred on the ranges data/generators/telemetry.py samples
 * for the "work" state (hydraulic ~210±30 bar), not a manufacturer spec sheet.
 */

export type MachineHealthInput = {
  hydraulicPressureBar: number;
  hydraulicOilTempC: number;
  coolantTempC: number;
  defLevelPct: number;
  faultCodeActive: boolean;
  hoursSinceLastService: number;
  serviceIntervalHrs: number;
};

export type Severity = "caution" | "danger";

export type MachineHealthFlag = {
  reason: string;
  severity: Severity;
};

const HYDRAULIC_LOW_BAR = 100;
const HYDRAULIC_HIGH_BAR = 320;
const OVERHEAT_C = 105;
const DEF_LOW_PCT = 10;

export function machineHealthAlert(input: MachineHealthInput): MachineHealthFlag[] {
  const flags: MachineHealthFlag[] = [];

  if (input.hydraulicPressureBar < HYDRAULIC_LOW_BAR) {
    flags.push({
      reason: `Hydraulic pressure low (${input.hydraulicPressureBar.toFixed(0)} bar)`,
      severity: "danger",
    });
  } else if (input.hydraulicPressureBar > HYDRAULIC_HIGH_BAR) {
    flags.push({
      reason: `Hydraulic pressure high (${input.hydraulicPressureBar.toFixed(0)} bar)`,
      severity: "caution",
    });
  }

  if (input.hydraulicOilTempC > OVERHEAT_C) {
    flags.push({ reason: `Hydraulic oil overheating (${input.hydraulicOilTempC.toFixed(0)}°C)`, severity: "danger" });
  }
  if (input.coolantTempC > OVERHEAT_C) {
    flags.push({ reason: `Coolant overheating (${input.coolantTempC.toFixed(0)}°C)`, severity: "danger" });
  }
  if (input.defLevelPct < DEF_LOW_PCT) {
    flags.push({ reason: `DEF level low (${input.defLevelPct.toFixed(0)}%)`, severity: "caution" });
  }
  if (input.faultCodeActive) {
    flags.push({ reason: "Active fault code reported by the machine", severity: "danger" });
  }
  if (input.hoursSinceLastService > input.serviceIntervalHrs) {
    flags.push({
      reason: `Service overdue by ${(input.hoursSinceLastService - input.serviceIntervalHrs).toFixed(0)}h`,
      severity: "caution",
    });
  }

  return flags;
}

export function worstSeverity(flags: MachineHealthFlag[]): Severity | "ok" {
  if (flags.some((f) => f.severity === "danger")) return "danger";
  if (flags.length > 0) return "caution";
  return "ok";
}
