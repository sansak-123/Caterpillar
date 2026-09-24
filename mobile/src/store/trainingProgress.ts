import { create } from "zustand";

import type { GhostScore } from "../lib/unity/bridge";

// Real data from the Unity bridge (GhostScore/session length) was being received and
// immediately discarded — SimulatorScreen held it in local useState that reset on every
// navigation, so nothing about a practice session survived long enough to show anywhere
// else. This is the persistence layer for the Training tab's "your progress" dashboard.
export type PracticeSession = {
  id: string;
  scenarioId: string;
  completedAt: string; // ISO timestamp
  durationS: number;
  skillFactor: number;
  matchPct: number;
};

type TrainingProgressState = {
  completedLessonIds: Set<string>;
  sessions: PracticeSession[];
  markLessonComplete: (id: string) => void;
  markLessonIncomplete: (id: string) => void;
  recordSession: (scenarioId: string, score: GhostScore) => void;
};

export const useTrainingProgressStore = create<TrainingProgressState>((set) => ({
  completedLessonIds: new Set(),
  sessions: [],
  markLessonComplete: (id) =>
    set((s) => {
      const next = new Set(s.completedLessonIds);
      next.add(id);
      return { completedLessonIds: next };
    }),
  markLessonIncomplete: (id) =>
    set((s) => {
      const next = new Set(s.completedLessonIds);
      next.delete(id);
      return { completedLessonIds: next };
    }),
  recordSession: (scenarioId, score) =>
    set((s) => ({
      sessions: [
        {
          id: `${Date.now()}`,
          scenarioId,
          completedAt: new Date().toISOString(),
          durationS: score.duration_s,
          skillFactor: score.skill_factor,
          matchPct: score.match_pct,
        },
        ...s.sessions,
      ].slice(0, 100),
    })),
}));

export function totalPracticeSeconds(sessions: PracticeSession[]): number {
  return sessions.reduce((sum, s) => sum + s.durationS, 0);
}

export function formatPracticeDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}
