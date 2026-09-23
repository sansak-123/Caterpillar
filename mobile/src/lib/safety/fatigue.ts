/**
 * Fatigue & alertness — CLAUDE.md USP-6 / section 6 `fatigue_alert`.
 * `fatigueScore` (0-1) is the same NIOSH-grounded curve used server-side for the
 * task-time model's fatigue multiplier (section 5) — here it's read as an active
 * safety signal instead of a hidden multiplier. Private to the operator (§2.1 Rule 2).
 */

export type FatigueLevel = "ok" | "caution" | "danger";

export type FatigueResult = {
  level: FatigueLevel;
  recommendBreak: boolean;
  message: string;
};

const CAUTION_THRESHOLD = 0.6;
const DANGER_THRESHOLD = 0.85;

export function fatigueAlert(fatigueScore: number, hoursOnShift: number): FatigueResult {
  if (fatigueScore >= DANGER_THRESHOLD) {
    return {
      level: "danger",
      recommendBreak: true,
      message: `Fatigue risk is high after ${hoursOnShift.toFixed(1)}h on shift — take a break before your next task.`,
    };
  }
  if (fatigueScore >= CAUTION_THRESHOLD) {
    return {
      level: "caution",
      recommendBreak: true,
      message: `Fatigue is building (${hoursOnShift.toFixed(1)}h on shift) — a short break now helps the rest of your day.`,
    };
  }
  return { level: "ok", recommendBreak: false, message: "Alertness looks normal for this point in your shift." };
}
