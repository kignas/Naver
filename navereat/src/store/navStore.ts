import { create } from 'zustand';

export type NavDirection = 'push' | 'pop' | 'tab';

interface NavState {
  direction: NavDirection;
  preparing: boolean;
  /** How many detail route layers are on screen (0 = a tab route is on top). */
  detailDepth: number;
  setDirection: (direction: NavDirection) => void;
  setPreparing: (preparing: boolean) => void;
  setDetailDepth: (depth: number) => void;
}

export const useNavStore = create<NavState>((set) => ({
  direction: 'tab',
  preparing: false,
  detailDepth: 0,
  setDirection: (direction) => set({ direction }),
  setPreparing: (preparing) => set({ preparing }),
  setDetailDepth: (detailDepth) => set({ detailDepth }),
}));

export const useNavDirection = (): NavDirection => useNavStore((state) => state.direction);
