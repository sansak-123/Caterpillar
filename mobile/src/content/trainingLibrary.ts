/**
 * Real training lesson content — CLAUDE.md section 6 ("Training hub"). Not placeholder
 * stat cards: each lesson has a real title and summary grounded in the same standards
 * referenced in section 5 (ISO 5006 blind spots, ISO 6683/3471 seatbelt+ROPS, OSHA 29
 * CFR 1926.602, ISO 16001/21815 proximity systems, CAT Performance Handbook cycle
 * time). Video URIs are placeholders (`videoUri: null`) until real footage exists —
 * the content and structure are real, the media asset is the only missing piece.
 */

export type LessonCategory = "safety" | "efficiency" | "compliance" | "onboarding" | "skill";

export type Lesson = {
  id: string;
  title: string;
  category: LessonCategory;
  durationMin: number;
  languages: Array<"en" | "hi" | "ta">;
  summary: string;
  standardRef?: string;
  downloadedOffline: boolean;
  videoUri: string | null;
};

export const trainingLibrary: Lesson[] = [
  {
    id: "seatbelt-rops-5s",
    title: "Seatbelt & ROPS: Why 5 Seconds Matters",
    category: "safety",
    durationMin: 4,
    languages: ["en", "hi", "ta"],
    summary:
      "The rollover protective structure only protects you if you're strapped into the seat it's built around — this walks through real rollover geometry and why the app alerts after 5 seconds unfastened while moving, not immediately.",
    standardRef: "OSHA 29 CFR 1926.602, ISO 3471 (ROPS), ISO 6683 (seatbelts)",
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "reading-blind-spots",
    title: "Reading Your Machine's Blind Spots",
    category: "safety",
    durationMin: 6,
    languages: ["en", "hi", "ta"],
    summary:
      "Every machine class has a different blind-spot shape — excavators lose the rear arc when swinging, wheel loaders lose the front over a raised bucket. Learn your machine's actual blind-spot profile, not a generic rule of thumb.",
    standardRef: "ISO 5006 (operator field of view)",
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "proximity-alert-levels",
    title: "Amber vs Red: Understanding Proximity Alerts",
    category: "safety",
    durationMin: 3,
    languages: ["en", "hi", "ta"],
    summary:
      "Why the app's warning radius isn't a fixed number — it widens in rain, wind, and low visibility, and tightens the rear sector further during swing or reverse. Knowing why a zone moved builds trust in the alert instead of annoyance at it.",
    standardRef: "ISO 16001, ISO 21815 (proximity/collision warning systems)",
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "reversing-safely",
    title: "Reversing Safely: Blind Spot & Spotter Protocol",
    category: "safety",
    durationMin: 5,
    languages: ["en", "hi", "ta"],
    summary:
      "When to reverse on instruments alone versus when the job requires a spotter, and how to communicate with a spotter without leaving the cab.",
    standardRef: "ISO 5006, ISO 21815",
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "monsoon-conditions",
    title: "Working Safely in Monsoon Conditions",
    category: "safety",
    durationMin: 5,
    languages: ["en", "hi", "ta"],
    summary:
      "Reduced traction, reduced visibility, and softer ground bearing capacity all compound in heavy rain — practical adjustments to dig depth, travel speed, and load size during the wet season.",
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "efficient-dig-cycles",
    title: "Efficient Dig Cycles: Boom–Stick–Bucket Timing",
    category: "skill",
    durationMin: 8,
    languages: ["en", "hi", "ta"],
    summary:
      "The four phases of a dig cycle — dig, swing-load, dump, swing-return — and how experts overlap boom/stick/bucket motion to cut cycle time without rushing. This is exactly what the Ghost Operator simulator scores you against.",
    standardRef: "CAT Performance Handbook cycle-time methodology",
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "idle-discipline-savings",
    title: "Idle Discipline: Fuel & Wear Savings",
    category: "efficiency",
    durationMin: 5,
    languages: ["en", "hi", "ta"],
    summary:
      "Idle fuel burn is 3-5 L/h depending on machine size — over a shift, unjustified idle adds up in fuel cost and engine hours toward the next service. Covers the difference between necessary standby and avoidable idle.",
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "pre-start-checklist-walkthrough",
    title: "Pre-Start Walkaround Checklist Walkthrough",
    category: "compliance",
    durationMin: 4,
    languages: ["en", "hi", "ta"],
    summary:
      "A guided run-through of the digital pre-start checklist — what each item is actually checking for and why it replaces the paper walkaround, not just digitizes it.",
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "reading-task-cards",
    title: "Reading Your Daily Task Card",
    category: "onboarding",
    durationMin: 3,
    languages: ["en", "hi", "ta"],
    summary:
      "What each part of a task card means — dig depth, hazard callouts, P50/P90 time range — and how to use the voice read-out without taking your hands off the controls.",
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "ghost-operator-scoring",
    title: "Ghost Operator: How Scoring Works",
    category: "skill",
    durationMin: 4,
    languages: ["en", "hi", "ta"],
    summary:
      "Cycle time, smoothness (jerk), fuel per cycle, and idle seconds — what each scored metric means and how closing the gap with the ghost actually tightens your personal task-time estimates.",
    downloadedOffline: false,
    videoUri: null,
  },
];

export function lessonsByCategory(category: LessonCategory): Lesson[] {
  return trainingLibrary.filter((l) => l.category === category);
}

export function downloadedLessons(): Lesson[] {
  return trainingLibrary.filter((l) => l.downloadedOffline);
}
