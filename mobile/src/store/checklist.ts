import { create } from "zustand";

// CLAUDE.md §2.1 Rule 5 / section 6 "Digital pre-start checklist" — tracks completion
// so the rest of the app (Today screen, eventually the backend's
// pre_start_checklist_completed field) can reflect real operator action instead of a
// synthetic label.
type ChecklistState = {
  checkedIds: Set<string>;
  toggle: (id: string) => void;
  reset: () => void;
};

export const useChecklistStore = create<ChecklistState>((set) => ({
  checkedIds: new Set(),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.checkedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { checkedIds: next };
    }),
  reset: () => set({ checkedIds: new Set() }),
}));
