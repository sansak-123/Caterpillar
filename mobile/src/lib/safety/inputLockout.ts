/**
 * CLAUDE.md section 2.1 Rule 1 / section 6 `input_lockout` — a hard gate, not a UI
 * convention: like a car's infotainment lockout, tap-based confirmations (near-miss
 * confirm/dismiss, idle-intent chip) are only accepted while the machine is stationary.
 * While moving, the app communicates outward only (sound/haptics/color) and never
 * solicits a tap. Voice confirmation bypasses this entirely — it's the one channel safe
 * to use while hands are on the controls.
 */

export function isStationary(travelKmh: number, swingRateDps: number): boolean {
  return travelKmh < 0.3 && swingRateDps < 2;
}

export type ConfirmationChannel = "tap" | "voice";

/** Whether a confirmation attempt through this channel should be accepted right now,
 * or deferred/queued until the machine stops (tap) — voice is always accepted. */
export function acceptsConfirmation(channel: ConfirmationChannel, travelKmh: number, swingRateDps: number): boolean {
  if (channel === "voice") return true;
  return isStationary(travelKmh, swingRateDps);
}
