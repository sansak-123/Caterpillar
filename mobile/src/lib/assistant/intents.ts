/**
 * Mirrors backend/app/assistant/intents.py's keyword matcher exactly — CLAUDE.md
 * section 6 intents: log incident, explain estimate, safety question, "why was I
 * flagged", book instructor. Duplicated (not shared) because the backend is Python and
 * the device needs this to work with zero network, offline-first per section 3.1 — if
 * you change the keyword lists, update both files.
 */

export type Intent =
  | "log_incident"
  | "explain_estimate"
  | "why_flagged"
  | "book_instructor"
  | "safety_question"
  | "general";

const KEYWORDS: [Intent, string[]][] = [
  [
    "log_incident",
    [
      "log incident",
      "report incident",
      "log a near",
      "report a near",
      "near miss",
      "near-miss",
      "something happened",
    ],
  ],
  [
    "why_flagged",
    ["why was i flagged", "why am i flagged", "why flagged", "my flags", "my anomaly", "why did i get"],
  ],
  [
    "explain_estimate",
    [
      "explain my estimate",
      "explain estimate",
      "why is my estimate",
      "why is this task",
      "task time",
      "how long will",
      "estimate",
    ],
  ],
  ["book_instructor", ["book instructor", "book an instructor", "book a trainer", "schedule training", "instructor"]],
  ["safety_question", ["seatbelt", "proximity", "idle", "fatigue", "slope", "rollover", "hazard", "safety"]],
];

export function matchIntent(text: string): Intent {
  const lowered = text.toLowerCase();
  for (const [intent, keywords] of KEYWORDS) {
    if (keywords.some((k) => lowered.includes(k))) return intent;
  }
  return "general";
}
