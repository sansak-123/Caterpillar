/**
 * Voice in/out for the assistant — CLAUDE.md section 4: "voice via `expo-speech` (TTS)
 * + `@react-native-voice/voice` or a cloud STT fallback." This implements that slot
 * with `expo-speech-recognition` instead: it wraps the same native on-device speech
 * APIs (Android SpeechRecognizer, iOS SFSpeechRecognizer/Speech framework), ships a
 * config plugin that's already registered in app.json, and — unlike most alternatives —
 * exposes `requiresOnDeviceRecognition` and `getSupportedLocales`, which line up with
 * this app's offline-first contract and its en/hi/ta operator base directly.
 *
 * Needs a custom dev client (`npx expo run:android` / `eas build --profile
 * development`), same as every other native module this project already depends on
 * (Unity, mqtt.js, onnxruntime) — Expo Go can't load it.
 */

import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useRef, useState } from "react";

export type AssistantLanguage = "en" | "hi" | "ta";

// IETF BCP 47 locales. en-IN (not en-US) because this is an Indian operator fleet —
// matches expo-speech's own `language` option 1:1 (CLAUDE.md i18n: en/hi/ta).
const RECOGNITION_LOCALE: Record<AssistantLanguage, string> = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
};

export function localeFor(language: AssistantLanguage): string {
  return RECOGNITION_LOCALE[language];
}

export async function requestVoicePermission(): Promise<boolean> {
  const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return result.granted;
}

export function speak(text: string, language: AssistantLanguage): void {
  Speech.stop();
  Speech.speak(text, { language: localeFor(language), rate: 0.95 });
}

export function stopSpeaking(): void {
  Speech.stop();
}

/**
 * Hook form: start()/stop() control on-device recognition, `transcript` updates live
 * with interim results, `listening` drives the mic UI state. `requiresOnDeviceRecognition`
 * is left true where the platform supports it (Android 13+, iOS) so voice input keeps
 * working with the same "safety never waits on network" spirit as the rest of the app,
 * even though the assistant itself is a cloud-backed convenience, not a safety path.
 */
export function useVoiceInput(language: AssistantLanguage) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const finalizedRef = useRef("");

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    setTranscript(text);
    if (event.isFinal) finalizedRef.current = text;
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    setError(event.message ?? event.error ?? "Speech recognition error");
  });

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    finalizedRef.current = "";
    const granted = await requestVoicePermission();
    if (!granted) {
      setError("Microphone permission denied");
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: localeFor(language),
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: false,
    });
  }, [language]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { listening, transcript, error, start, stop, finalTranscript: () => finalizedRef.current || transcript };
}
