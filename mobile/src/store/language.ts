import { create } from "zustand";

import type { AssistantLanguage } from "../lib/assistant/voice";

// The operator's active language for the assistant (voice + text) — CLAUDE.md i18n
// scope (en/hi/ta). Full app-wide i18n (react-i18next) is out of scope for now; this is
// deliberately just the assistant's own language switch, seeded from the demo
// operator's `Operator.language` profile field once a session exists.
type LanguageState = {
  language: AssistantLanguage;
  setLanguage: (language: AssistantLanguage) => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "en",
  setLanguage: (language) => set({ language }),
}));
