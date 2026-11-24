import { create } from 'zustand';

export type NavDirection = 'push' | 'pop' | 'tab';

interface NavState {
  direction: NavDirection;
  preparing: boolean;
  setDirection: (direction: NavDirection) => void;
  setPreparing: (preparing: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  direction: 'tab',
  preparing: false,
  setDirection: (direction) => set({ direction }),
  setPreparing: (preparing) => set({ preparing }),
}));

export const useNavDirection = (): NavDirection => useNavStore((state) => state.direction);
