import { create } from "zustand";

export type SyncStatus = "online" | "offline" | "syncing";

type ConnectivityState = {
  status: SyncStatus;
  queuedCount: number;
  lastSyncAt: string | null;
  devNetworkCut: boolean;
  setStatus: (status: SyncStatus) => void;
  setQueuedCount: (count: number) => void;
  markSynced: () => void;
  toggleDevNetworkCut: () => void;
};

// Backs the persistent connectivity pill (CLAUDE.md 3.1) and the dev-only "Cut network"
// toggle. The real sync engine (lib/sync, built in Phase 4) will drive `status`/`queuedCount`
// from NetInfo + the outbox; this store is the single source the UI reads from.
export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: "online",
  queuedCount: 0,
  lastSyncAt: null,
  devNetworkCut: false,
  setStatus: (status) => set({ status }),
  setQueuedCount: (queuedCount) => set({ queuedCount }),
  markSynced: () => set({ lastSyncAt: new Date().toISOString(), queuedCount: 0 }),
  toggleDevNetworkCut: () =>
    set((s) => ({
      devNetworkCut: !s.devNetworkCut,
      status: !s.devNetworkCut ? "offline" : "online",
    })),
}));
