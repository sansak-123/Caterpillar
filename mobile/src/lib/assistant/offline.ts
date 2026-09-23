import MiniSearch from "minisearch";

import { assistantKb } from "../../content/assistantKb";
import { matchIntent, type Intent } from "./intents";

type IndexedKbEntry = { id: string; title: string; keywordsText: string; answer: string };

const index = new MiniSearch<IndexedKbEntry>({
  fields: ["title", "keywordsText", "answer"],
  storeFields: ["answer", "title"],
  searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2, keywordsText: 3 } },
});
index.addAll(
  assistantKb.map((entry) => ({
    id: entry.id,
    title: entry.title,
    keywordsText: entry.keywords.join(" "),
    answer: entry.answer,
  }))
);

export type OfflineReply = { reply: string; intent: Intent };

/**
 * The real on-device fallback CLAUDE.md section 3.1 requires: "intent matcher +
 * MiniSearch over cached safety cards, SOPs, and training snippets." Runs with zero
 * network. Safety questions get a real answer from the bundled KB; anything that needs
 * a live grounded lookup (today's actual estimate, your actual flag history) or a
 * server-side action (filing an incident, requesting a booking) says so plainly rather
 * than faking data it doesn't have.
 */
export function answerOffline(message: string): OfflineReply {
  const intent = matchIntent(message);

  if (intent === "safety_question") {
    const hits = index.search(message);
    if (hits.length > 0) {
      const top = hits[0] as unknown as { answer: string };
      return { reply: top.answer, intent };
    }
    return {
      reply:
        "I don't have a cached answer for that specific question. Try asking about " +
        "seatbelt, proximity, idle, fatigue, slope, near-miss, machine health, or the checklist.",
      intent,
    };
  }

  if (intent === "explain_estimate") {
    return {
      reply: "Explaining today's live estimate needs a connection — I'll answer as soon as you're back online.",
      intent,
    };
  }
  if (intent === "why_flagged") {
    return {
      reply: "Your flag history is pulled live from the server, so I need a connection to check it.",
      intent,
    };
  }
  if (intent === "log_incident") {
    return {
      reply:
        "I can't file a structured draft offline yet — the near-miss autopilot still " +
        "logs it locally the moment it happens, and you can confirm by voice any time. " +
        "This assistant flow needs a connection.",
      intent,
    };
  }
  if (intent === "book_instructor") {
    return { reply: "Booking an instructor needs a connection — try again once you're back online.", intent };
  }

  return {
    reply:
      "I'm running offline right now, so I can only answer from cached safety notes — " +
      "try asking about seatbelt, proximity, idle, fatigue, slope, or near-miss rules.",
    intent,
  };
}
