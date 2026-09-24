import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources, type SupportedLanguage } from "./resources";

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "hi", "ta"];

/** Maps the device's own locale to one of our three supported languages, falling back
 * to English rather than a language we have no translations for (CLAUDE.md i18n:
 * en/hi/ta only). */
export function detectDeviceLanguage(): SupportedLanguage {
  const code = getLocales()[0]?.languageCode ?? "en";
  return SUPPORTED_LANGUAGES.includes(code as SupportedLanguage) ? (code as SupportedLanguage) : "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React already escapes — i18next doesn't need to
  });
}

export default i18n;
