import { formatPracticeDuration, totalPracticeSeconds, useTrainingProgressStore, type PracticeSession } from "./trainingProgress";

beforeEach(() => {
  useTrainingProgressStore.setState({ completedLessonIds: new Set(), sessions: [] });
});

describe("useTrainingProgressStore", () => {
  it("toggles lesson completion", () => {
    useTrainingProgressStore.getState().markLessonComplete("welcome-to-operatoros");
    expect(useTrainingProgressStore.getState().completedLessonIds.has("welcome-to-operatoros")).toBe(true);

    useTrainingProgressStore.getState().markLessonIncomplete("welcome-to-operatoros");
    expect(useTrainingProgressStore.getState().completedLessonIds.has("welcome-to-operatoros")).toBe(false);
  });

  it("records a practice session from a real GhostScore payload", () => {
    useTrainingProgressStore.getState().recordSession("GhostOperator", {
      operator_id: "OP1001",
      ghost_operator_id: "expert-1",
      duration_s: 240,
      match_pct: 82,
      cycles: 6,
      avg_cycle_s: 40,
      ghost_cycle_s: 35,
      smoothness_pct: 75,
      idle_s: 12,
      fuel_per_cycle_l: 1.1,
      skill_factor: 0.82,
    });

    const sessions = useTrainingProgressStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ scenarioId: "GhostOperator", durationS: 240, skillFactor: 0.82, matchPct: 82 });
  });

  it("caps stored sessions at 100, keeping the most recent", () => {
    for (let i = 0; i < 105; i++) {
      useTrainingProgressStore.getState().recordSession("GhostOperator", {
        operator_id: "OP1001",
        ghost_operator_id: "expert-1",
        duration_s: 60,
        match_pct: 50,
        cycles: 1,
        avg_cycle_s: 60,
        ghost_cycle_s: 60,
        smoothness_pct: 50,
        idle_s: 0,
        fuel_per_cycle_l: 1,
        skill_factor: 0.5,
      });
    }
    expect(useTrainingProgressStore.getState().sessions).toHaveLength(100);
  });
});

describe("totalPracticeSeconds", () => {
  it("sums durations across sessions", () => {
    const sessions: PracticeSession[] = [
      { id: "1", scenarioId: "a", completedAt: "2026-01-01", durationS: 120, skillFactor: 0.5, matchPct: 50 },
      { id: "2", scenarioId: "b", completedAt: "2026-01-02", durationS: 180, skillFactor: 0.6, matchPct: 60 },
    ];
    expect(totalPracticeSeconds(sessions)).toBe(300);
  });

  it("returns 0 for no sessions", () => {
    expect(totalPracticeSeconds([])).toBe(0);
  });
});

describe("formatPracticeDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatPracticeDuration(45)).toBe("45s");
  });

  it("formats minutes under an hour", () => {
    expect(formatPracticeDuration(300)).toBe("5 min");
  });

  it("formats whole hours", () => {
    expect(formatPracticeDuration(3600)).toBe("1h");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatPracticeDuration(3900)).toBe("1h 5m");
  });
});
