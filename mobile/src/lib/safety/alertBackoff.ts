/**
 * CLAUDE.md section 2.1 Rule 4 — "No repeated re-alerting for the same condition within
 * a short window — once acknowledged, exponential backoff before it can fire again."
 * Pure and timer-free so it's directly unit-testable: given when a loud alert last fired
 * for this condition and how many times it's already repeated, says whether enough time
 * has passed to fire loud again.
 */

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 300_000;

export function backoffDurationMs(repeatCount: number): number {
  const scaled = BASE_BACKOFF_MS * 2 ** Math.max(0, repeatCount);
  return Math.min(scaled, MAX_BACKOFF_MS);
}

export function shouldFireLoudAlert(nowMs: number, lastFiredAtMs: number | null, repeatCount: number): boolean {
  if (lastFiredAtMs === null) return true;
  return nowMs - lastFiredAtMs >= backoffDurationMs(repeatCount);
}
