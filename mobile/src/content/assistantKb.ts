/**
 * The assistant's offline knowledge base — CLAUDE.md section 3.1: "Offline: intent
 * matcher + MiniSearch over cached safety cards, SOPs, and training snippets." This is
 * the on-device source of truth for that fallback; it ships bundled in the app (no
 * network needed) and is indexed by lib/assistant/offline.ts with MiniSearch.
 *
 * Kept content-consistent with the backend's own small KB in
 * backend/app/assistant/service.py (`_SAFETY_KB`) — there's no shared codegen between
 * the two runtimes, so if you add/edit an entry here, mirror the wording there too.
 */

export type KbEntry = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  standardRef?: string;
};

export const assistantKb: KbEntry[] = [
  {
    id: "seatbelt",
    title: "Why the seatbelt alert works the way it does",
    keywords: ["seatbelt", "belt", "unfastened", "rollover"],
    answer:
      "The seatbelt alert only interrupts you once the machine is moving or swinging " +
      "and the belt has been off for more than 5 seconds — idle with the belt off just " +
      "gets a quiet reminder. It exists to survive a rollover, nothing else.",
    standardRef: "OSHA 29 CFR 1926.602 · ISO 6683",
  },
  {
    id: "proximity",
    title: "How proximity zones adapt",
    keywords: ["proximity", "zone", "red zone", "amber", "blind spot", "worker nearby"],
    answer:
      "Proximity zones aren't fixed rings — they widen automatically in rain, wind, or " +
      "low visibility, and the rear sector counts for more because it's your blind spot.",
    standardRef: "ISO 5006 · ISO 16001 · ISO 21815",
  },
  {
    id: "idle-intent",
    title: "Why you're asked about idle time",
    keywords: ["idle", "idling", "why did it ask", "truck wait", "warm up"],
    answer:
      "Tapping a reason after 3+ minutes idle isn't about watching you — it's proof on " +
      "record that a delay like a truck wait or warm-up wasn't your fault.",
  },
  {
    id: "fatigue",
    title: "What the fatigue check is for",
    keywords: ["fatigue", "tired", "night shift", "break"],
    answer:
      "The fatigue check looks at hours awake and consecutive night shifts. It's " +
      "private coaching for you, not a number your supervisor sees.",
    standardRef: "NIOSH shift-work guidance",
  },
  {
    id: "slope",
    title: "How the slope/rollover alert is calculated",
    keywords: ["slope", "rollover", "tip over", "stability", "steep"],
    answer:
      "Slope alerts compare your current angle against your machine class's tested " +
      "rollover stability angle, tightened further on wet or soft ground.",
    standardRef: "ISO 3471 ROPS static stability testing",
  },
  {
    id: "near-miss",
    title: "How a near-miss gets logged",
    keywords: ["near miss", "near-miss", "close call", "log incident", "confirm"],
    answer:
      "A near-miss gets drafted automatically the moment it's detected, but nothing is " +
      "filed until you confirm it — a tap once you're stopped, or a spoken word any time.",
  },
  {
    id: "machine-health",
    title: "What the machine-health flags mean",
    keywords: ["hydraulic", "coolant", "def level", "fault code", "machine health"],
    answer:
      "Hydraulic pressure, oil and coolant temperature, DEF level, and active fault " +
      "codes are all watched live — each flag names the exact reading and threshold it " +
      "crossed, never just 'machine issue'.",
  },
  {
    id: "responsiveness",
    title: "What the 'are you okay?' check is",
    keywords: ["are you okay", "check in", "responsiveness", "no response"],
    answer:
      "If the engine's on, your belt's fastened, but there's been no control input for " +
      "an unusually long stationary stretch, a soft voice check-in fires. No response " +
      "escalates to a welfare check, not a discipline flag.",
  },
  {
    id: "checklist",
    title: "What the pre-start checklist replaces",
    keywords: ["checklist", "pre-start", "walkaround", "paperwork"],
    answer:
      "The digital pre-start checklist replaces the paper walkaround — one tap per " +
      "item, works offline, and feeds your PPE-compliance record automatically.",
  },
  {
    id: "shift-log",
    title: "What the end-of-shift log does",
    keywords: ["shift log", "end of shift", "sign off", "hours", "fuel used"],
    answer:
      "Your hours, fuel used, load cycles, and completed tasks are pulled straight from " +
      "telemetry into the end-of-shift log — you just review and sign instead of " +
      "filling it in from memory.",
  },
];
