import { create } from 'zustand';

export type NavDirection = 'push' | 'pop' | 'tab';

interface NavState {
  direction: NavDirection;
  setDirection: (direction: NavDirection) => void;
}

export const useNavStore = create<NavState>((set) => ({
  direction: 'tab',
  setDirection: (direction) => set({ direction }),
}));

export const useNavDirection = (): NavDirection => useNavStore((state) => state.direction);
