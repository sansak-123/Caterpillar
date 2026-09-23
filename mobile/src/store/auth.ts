import { create } from "zustand";

import { deleteSecureItem, getSecureItem, setSecureItem } from "../lib/storage/secureStore";

const TOKEN_KEY = "operatoros.token";
const OPERATOR_ID_KEY = "operatoros.operatorId";

// CLAUDE.md §3.2: JWT stored in expo-secure-store (Keychain/Keystore-backed), so a
// session survives an app restart instead of forcing a fresh login/register every time —
// see lib/storage/secureStore.ts for the one platform caveat (no web keychain to back it
// with, so the web preview used in this dev environment falls back to localStorage).
type AuthState = {
  token: string | null;
  operatorId: string | null;
  hydrated: boolean;
  setSession: (token: string, operatorId: string) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  operatorId: null,
  hydrated: false,
  setSession: (token, operatorId) => {
    set({ token, operatorId });
    setSecureItem(TOKEN_KEY, token).catch(() => {});
    setSecureItem(OPERATOR_ID_KEY, operatorId).catch(() => {});
  },
  clear: () => {
    set({ token: null, operatorId: null });
    deleteSecureItem(TOKEN_KEY).catch(() => {});
    deleteSecureItem(OPERATOR_ID_KEY).catch(() => {});
  },
  hydrate: async () => {
    const [token, operatorId] = await Promise.all([
      getSecureItem(TOKEN_KEY),
      getSecureItem(OPERATOR_ID_KEY),
    ]);
    set({ token: token ?? null, operatorId: operatorId ?? null, hydrated: true });
  },
}));
