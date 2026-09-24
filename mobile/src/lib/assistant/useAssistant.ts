import { useCallback, useEffect, useState } from "react";

import {
  DEMO_MACHINE_ID,
  postAssistantChat,
  postBookingRequest,
  postIncidentReport,
  type BookingResponse,
  type IncidentReportResponse,
} from "../api/client";
import { useAuthStore } from "../../store/auth";
import { useConnectivityStore } from "../../store/connectivity";
import { answerOffline } from "./offline";
import { speak, type AssistantLanguage } from "./voice";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?:
    | { kind: "incident_draft"; incident: IncidentReportResponse }
    | { kind: "booking"; booking: BookingResponse };
};

function nextId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const GREETING: Record<AssistantLanguage, string> = {
  en: "How can I help? Ask about your estimate, a safety flag, or say what happened.",
  hi: "Main kaise madad kar sakta hoon? Apne estimate ya safety ke baare mein poochein.",
  ta: "Naan eppadi udhavi seiya mudiyum? Un mathippedu allathu paathukaappu pathi kelungal.",
};

/**
 * The assistant's real online/offline decision and chat state — CLAUDE.md section 3.1:
 * calls the real backend (OpenRouter-backed) when there's a connection, falls back to
 * the on-device intent matcher + MiniSearch KB (lib/assistant/offline.ts) otherwise.
 * Every reply is also spoken aloud via TTS, since this is meant to be usable without
 * looking at or holding the screen.
 */
export function useAssistant(language: AssistantLanguage) {
  // Session is bootstrapped once at the app root (src/app/_layout.tsx) — this hook just
  // reads it reactively rather than racing its own login/register call against that one.
  const token = useAuthStore((s) => s.token);
  const connectivity = useConnectivityStore((s) => s.status);
  const devNetworkCut = useConnectivityStore((s) => s.devNetworkCut);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "assistant", text: GREETING[language] },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMessages((previous) => {
      if (previous.length !== 1 || previous[0]?.id !== "greeting") return previous;
      return [{ id: "greeting", role: "assistant", text: GREETING[language] }];
    });
  }, [language]);

  const isOnline = !devNetworkCut && connectivity !== "offline";

  const appendAssistant = useCallback(
    (text: string, meta?: ChatMessage["meta"]) => {
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text, meta }]);
      speak(text, language);
    },
    [language]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, { id: nextId(), role: "user", text: trimmed }]);
      setBusy(true);
      try {
        if (isOnline && token) {
          const res = await postAssistantChat(token, { message: trimmed, language });
          appendAssistant(res.reply);
          return res;
        }
        const offline = answerOffline(trimmed);
        appendAssistant(offline.reply);
        return undefined;
      } catch {
        const offline = answerOffline(trimmed);
        appendAssistant(offline.reply);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [isOnline, token, language, appendAssistant]
  );

  const logIncident = useCallback(
    async (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, { id: nextId(), role: "user", text: trimmed }]);
      setBusy(true);
      try {
        if (!isOnline || !token) {
          appendAssistant(
            "Logging a structured draft needs a connection right now — the near-miss " +
              "autopilot still catches anything it detects on its own, offline."
          );
          return;
        }
        const incident = await postIncidentReport(token, {
          transcript: trimmed,
          machine_id: DEMO_MACHINE_ID,
          language,
        });
        appendAssistant(
          `Drafted: ${incident.type.replace("_", " ")} (${incident.severity}). ` +
            "It's saved as unconfirmed — review and confirm it from Incidents.",
          { kind: "incident_draft", incident }
        );
      } catch {
        appendAssistant("Couldn't reach the assistant to draft that — try again shortly.");
      } finally {
        setBusy(false);
      }
    },
    [isOnline, token, language, appendAssistant]
  );

  const bookInstructor = useCallback(async () => {
    setBusy(true);
    try {
      if (!isOnline || !token) {
        appendAssistant("Booking an instructor needs a connection — try again once you're back online.");
        return;
      }
      const booking = await postBookingRequest(token, {
        message: "book me the next available instructor slot",
        language,
      });
      appendAssistant(booking.reply, { kind: "booking", booking });
    } catch {
      appendAssistant("Couldn't reach the assistant to book that — try again shortly.");
    } finally {
      setBusy(false);
    }
  }, [isOnline, token, language, appendAssistant]);

  return { messages, busy, isOnline, sendMessage, logIncident, bookInstructor };
}
