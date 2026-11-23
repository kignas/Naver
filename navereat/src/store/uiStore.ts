import { create } from 'zustand';
import { restaurants, type MenuItem } from '../data/demo';

export type HomeSort = 'recommended' | 'rating' | 'delivery' | 'distance';
export type RestaurantTab = 'menu' | 'info';

export interface HomeUiState {
  vegOnly: boolean;
  nearFast: boolean;
  rating4: boolean;
  under30: boolean;
  under100: boolean;
  sortBy: HomeSort;
  activeFilterTab: string;
  scrollTop: number;
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
  home: HomeUiState;
  restaurants: Record<number, RestaurantUiState>;
  menus: Record<number, MenuItem[]>;
  markReady: (key: string) => void;
  patchHome: (patch: Partial<HomeUiState>) => void;
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
  home: initialHome,
  restaurants: {},
  menus: Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.menu])),

  markReady: (key) =>
    set((state) => (state.ready[key] ? state : { ready: { ...state.ready, [key]: true } })),

  patchHome: (patch) => set((state) => ({ home: { ...state.home, ...patch } })),

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
