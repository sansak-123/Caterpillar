import { create } from "zustand";

import i18n, { detectDeviceLanguage } from "../i18n";
import type { AssistantLanguage } from "../lib/assistant/voice";

// The operator's active language, shared by the assistant's voice (lib/assistant/voice.ts)
// and general app text (src/i18n) — one store drives both, so switching language in
// either place (the assistant's EN/HI/TA chips, or a future switcher elsewhere) changes
// everything at once, per CLAUDE.md's i18n scope (en/hi/ta) and §2.1 Rule 6.
type LanguageState = {
  language: AssistantLanguage;
  setLanguage: (language: AssistantLanguage) => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: detectDeviceLanguage(),
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
}));

// Keep i18next in sync with whatever this store's initial (device-detected) language is
// — `create`'s initializer runs before this line, so i18n's own `lng` (set from the same
// `detectDeviceLanguage()` call in src/i18n/index.ts) already matches; this just makes
// that invariant explicit rather than relying on both call sites agreeing by accident.
i18n.changeLanguage(useLanguageStore.getState().language);
