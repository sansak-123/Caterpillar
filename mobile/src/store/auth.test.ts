import { resetMockSecureStore } from "../lib/storage/testHelpers";
import { useAuthStore } from "./auth";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  resetMockSecureStore();
  useAuthStore.setState({ token: null, operatorId: null, hydrated: false });
});

describe("useAuthStore", () => {
  it("persists a session so hydrate() can restore it after a restart", async () => {
    useAuthStore.getState().setSession("tok1", "OP1001");
    await flushMicrotasks();

    // Simulate a fresh app start: in-memory state is gone, only secure storage remains.
    useAuthStore.setState({ token: null, operatorId: null, hydrated: false });
    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBe("tok1");
    expect(useAuthStore.getState().operatorId).toBe("OP1001");
    expect(useAuthStore.getState().hydrated).toBe(true);
  });

  it("clear() removes the persisted session, not just the in-memory one", async () => {
    useAuthStore.getState().setSession("tok1", "OP1001");
    await flushMicrotasks();

    useAuthStore.getState().clear();
    await flushMicrotasks();

    useAuthStore.setState({ token: "stale-in-memory-value", operatorId: "stale", hydrated: false });
    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().operatorId).toBeNull();
  });

  it("hydrate() on a first-ever run leaves the session null without throwing", async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().hydrated).toBe(true);
  });
});
