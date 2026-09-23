import { create } from "zustand";

// The telemetry-representable beats from CLAUDE.md §2's demo narrative arc — mirrors
// simulator/run.py's DEMO_SCRIPT beat names so a presenter can drive either the mobile
// UI directly (this store, consumed by SafetyScreen) or the real MQTT publisher and see
// the same story. Non-telemetry beats (network cut, sync, supervisor view, Unity
// replay) are separate presenter actions elsewhere in the app, not part of this store.
export type DemoBeat = "normal" | "seatbelt_idle" | "approaching" | "red_alert" | "recovery";

export const DEMO_BEAT_ORDER: DemoBeat[] = ["normal", "seatbelt_idle", "approaching", "red_alert", "recovery"];

export const DEMO_BEAT_LABEL: Record<DemoBeat, string> = {
  normal: "Normal work",
  seatbelt_idle: "10:00 seatbelt off + idle spike",
  approaching: "Worker closing into rear blind spot, swinging",
  red_alert: "RED ZONE — near-miss trigger window",
  recovery: "Recovery — worker clear, swing stopped",
};

type DemoState = {
  beat: DemoBeat;
  setBeat: (beat: DemoBeat) => void;
  nextBeat: () => void;
};

export const useDemoStore = create<DemoState>((set) => ({
  beat: "red_alert", // reproduces the seed-anchored scenario by default on first load
  setBeat: (beat) => set({ beat }),
  nextBeat: () =>
    set((s) => {
      const i = DEMO_BEAT_ORDER.indexOf(s.beat);
      return { beat: DEMO_BEAT_ORDER[(i + 1) % DEMO_BEAT_ORDER.length] };
    }),
}));
