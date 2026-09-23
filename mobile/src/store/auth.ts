import { create } from "zustand";

// Minimal in-memory auth state — enough to prove the real backend integration works.
// Real Phase 4 scope (expo-secure-store persistence, device registration, full
// offline-first sync) is a bigger lift than fits in the current timeline; this is
// deliberately scoped down to "the app can really talk to the real API."
type AuthState = {
  token: string | null;
  operatorId: string | null;
  setSession: (token: string, operatorId: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  operatorId: null,
  setSession: (token, operatorId) => set({ token, operatorId }),
  clear: () => set({ token: null, operatorId: null }),
}));
