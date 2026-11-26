import { create } from 'zustand';
import { restaurants, type MenuItem } from '../data/demo';

export type HomeSort = 'recommended' | 'rating' | 'delivery' | 'distance';
export type RestaurantTab = 'menu' | 'info';

/** The boolean feed filters; the VEG toggle and the filter pills share these. */
export type HomeFlag = 'vegOnly' | 'nearFast' | 'rating4' | 'under30' | 'under100';

/**
 * `loading` paints the restaurant skeleton, `empty` means the dish search found
 * no restaurant at all (the original shows "No restaurants available yet" for
 * that, and "No restaurants match your filters" only when the filters emptied a
 * non-empty result).
 */
export type CategoryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface HomeUiState {
  vegOnly: boolean;
  nearFast: boolean;
  rating4: boolean;
  under30: boolean;
  under100: boolean;
  sortBy: HomeSort;
  activeFilterTab: string;
  scrollTop: number;
  /** "What's on your mind?": the category filtered in place on Home. */
  activeCategory: string | null;
  categoryQuery: string | null;
  categoryStatus: CategoryStatus;
  categoryIds: number[];
  /** Why the category search failed, shown in the feed's error block. */
  categoryError: string | null;
}

export interface RestaurantUiState {
  tab: RestaurantTab;
  filters: string[];
  query: string;
  menuSearchOpen: boolean;
  saved: boolean;
  collapsed: string[];
  activeCategory: number;
  scrollTop: number;
}

interface UiState {
  ready: Record<string, boolean>;
  /** True once the cold-start entrance of the Home feed has finished playing. */
  homeHasEntered: boolean;
  home: HomeUiState;
  restaurants: Record<number, RestaurantUiState>;
  menus: Record<number, MenuItem[]>;
  markReady: (key: string) => void;
  markHomeEntered: () => void;
  patchHome: (patch: Partial<HomeUiState>) => void;
  toggleHomeFlag: (key: HomeFlag) => void;
  setHomeSort: (sortBy: HomeSort) => void;
  setActiveFilterTab: (tab: string) => void;
  resetHomeFilters: () => void;
  patchRestaurant: (id: number, patch: Partial<RestaurantUiState>) => void;
}

const initialHome: HomeUiState = {
  vegOnly: false,
  nearFast: false,
  rating4: false,
  under30: false,
  under100: false,
  sortBy: 'recommended',
  activeFilterTab: 'SORT',
  scrollTop: 0,
  activeCategory: null,
  categoryQuery: null,
  categoryStatus: 'idle',
  categoryIds: [],
  categoryError: null,
};

const initialRestaurant: RestaurantUiState = {
  tab: 'menu',
  filters: [],
  query: '',
  menuSearchOpen: false,
  saved: false,
  collapsed: [],
  activeCategory: 0,
  scrollTop: 0,
};

export const useUiStore = create<UiState>((set) => ({
  ready: {},
  homeHasEntered: false,
  home: initialHome,
  restaurants: {},
  menus: Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.menu])),

  markReady: (key) =>
    set((state) => (state.ready[key] ? state : { ready: { ...state.ready, [key]: true } })),

  markHomeEntered: () => set((state) => (state.homeHasEntered ? state : { homeHasEntered: true })),

  patchHome: (patch) => set((state) => ({ home: { ...state.home, ...patch } })),

  // Each action returns the untouched state object when nothing changes, so a
  // no-op tap cannot wake a single subscriber.
  toggleHomeFlag: (key) =>
    set((state) => {
      const next = !state.home[key];
      if (next === state.home[key]) return state;
      return { home: { ...state.home, [key]: next } };
    }),

  setHomeSort: (sortBy) =>
    set((state) => (state.home.sortBy === sortBy ? state : { home: { ...state.home, sortBy } })),

  setActiveFilterTab: (tab) =>
    set((state) => (state.home.activeFilterTab === tab ? state : { home: { ...state.home, activeFilterTab: tab } })),

  resetHomeFilters: () =>
    set((state) => ({
      home: {
        ...state.home,
        sortBy: initialHome.sortBy,
        vegOnly: false,
        nearFast: false,
        rating4: false,
        under30: false,
        under100: false,
      },
    })),

  patchRestaurant: (id, patch) =>
    set((state) => ({
      restaurants: {
        ...state.restaurants,
        [id]: { ...initialRestaurant, ...state.restaurants[id], ...patch },
      },
    })),
}));

export const getRestaurantUi = (id: number): RestaurantUiState =>
  useUiStore.getState().restaurants[id] ?? initialRestaurant;
