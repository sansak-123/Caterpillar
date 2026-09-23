import { create } from "zustand";

type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

// Light is the default (direct design feedback); dark stays a first-class toggle for
// the cab-glare/night-shift case in CLAUDE.md section 6, not the forced default.
export const useThemeStore = create<ThemeState>((set) => ({
  mode: "light",
  toggle: () => set((s) => ({ mode: s.mode === "light" ? "dark" : "light" })),
  setMode: (mode) => set({ mode }),
}));
