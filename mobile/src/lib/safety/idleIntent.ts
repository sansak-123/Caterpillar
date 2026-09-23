/**
 * Idle Intent Tagging — CLAUDE.md USP-3 / section 2.1 Rule 3. The one-tap idle reason
 * is framed as the operator's proof, not the company's monitor — but "protective" isn't
 * the same as "unverified." Every tag is checked against corroborating telemetry, so
 * the feature stays genuinely answerable: a single tag is always taken at face value
 * to the operator (never an on-the-spot accusation), but a *pattern* of tags that don't
 * match site conditions is a fair, evidence-based thing for a supervisor to raise —
 * framed as a conversation, not a violation (§2.1 Rule 2 still applies: aggregate
 * pattern, not a per-incident flag).
 */

export type IdleReason = "truck_wait" | "warmup" | "break" | "other";

export const IDLE_REASON_OPTIONS: { value: IdleReason; label: string }[] = [
  { value: "truck_wait", label: "Waiting for truck" },
  { value: "warmup", label: "Warm-up" },
  { value: "break", label: "Break" },
  { value: "other", label: "Other" },
];

export const IDLE_PROMPT_THRESHOLD_MIN = 3;

export function idlePromptCopy(idleMinutes: number): { headline: string; body: string } {
  return {
    headline: "Why the pause?",
    body: `You've been idle ${idleMinutes} min. Tag a reason and it's on record that this delay wasn't your fault — not a report against you.`,
  };
}

export function idleConfirmationCopy(reason: IdleReason): string {
  const phrasing: Record<IdleReason, string> = {
    truck_wait: "Logged as a truck-wait delay — on record as a site issue, not yours.",
    warmup: "Logged as warm-up time.",
    break: "Logged as a break. Rest matters — no explanation needed beyond this.",
    other: "Logged. Add a note anytime if you want more context on record.",
  };
  return phrasing[reason];
}

/** What's actually checkable from telemetry/context already generated for a window. */
export type IdleCorroborationContext = {
  isFirstIdleOfShift: boolean;
  nearbyMachinesCount: number;
  queuePositionEstimate: number;
};

export type IdleVerification = {
  corroborated: boolean;
  note: string;
};

/** Runs silently — never shown to the operator as a challenge. Feeds the aggregate
 * reliability pattern below, not a per-tag confrontation. */
export function verifyIdleReason(reason: IdleReason, context: IdleCorroborationContext): IdleVerification {
  switch (reason) {
    case "truck_wait":
      return context.nearbyMachinesCount > 0 || context.queuePositionEstimate > 0
        ? { corroborated: true, note: "Matches site telemetry (another machine/truck nearby)." }
        : { corroborated: false, note: "No corroborating site activity found for this window." };
    case "warmup":
      return context.isFirstIdleOfShift
        ? { corroborated: true, note: "Matches the first idle window of the shift." }
        : { corroborated: false, note: "Not the first idle window of the shift." };
    case "break":
    case "other":
      // Breaks are a right, not something to litigate per-instance; "other" is
      // inherently unverifiable. Both are taken at face value for a single tag.
      return { corroborated: true, note: "Taken at face value for a single instance." };
  }
}

const MIN_SAMPLE_FOR_PATTERN = 5;
const CORROBORATION_CONCERN_THRESHOLD = 0.7;

/**
 * Supervisor-facing summary — only fires on a real pattern (enough samples, and a
 * meaningfully low corroboration rate), and even then reads as a prompt for a
 * conversation, never as a verdict. This is the "answerable" half of the feature.
 */
export function reasonReliabilitySummary(totalTagged: number, corroboratedCount: number): string | null {
  if (totalTagged < MIN_SAMPLE_FOR_PATTERN) return null;
  const rate = corroboratedCount / totalTagged;
  if (rate >= CORROBORATION_CONCERN_THRESHOLD) return null;
  return `${Math.round((1 - rate) * 100)}% of this operator's recent idle tags weren't corroborated by site telemetry — worth a conversation, not an automatic flag.`;
}
