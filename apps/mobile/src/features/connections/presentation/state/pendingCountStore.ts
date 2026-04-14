import { create } from 'zustand';

interface PendingCountState {
  count: number;
  set: (n: number) => void;
  increment: () => void;
  decrement: () => void;
}

export const usePendingCount = create<PendingCountState>((set) => ({
  count: 0,
  set: (n) => set({ count: n }),
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}));
