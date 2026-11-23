import { create } from 'zustand';

export type SearchContext = 'home' | 'under99';

interface SearchState {
  isOpen: boolean;
  context: SearchContext;
  prefill: string;
  instantClose: boolean;
  nonce: number;
  openSearch: (context?: SearchContext, prefill?: string) => void;
  closeSearch: (instant?: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  context: 'home',
  prefill: '',
  instantClose: false,
  nonce: 0,
  openSearch: (context = 'home', prefill = '') =>
    set((state) => ({
      isOpen: true,
      context,
      prefill,
      instantClose: false,
      nonce: state.nonce + 1,
    })),
  closeSearch: (instant = false) => set({ isOpen: false, instantClose: instant }),
}));
