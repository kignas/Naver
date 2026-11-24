import { createContext, useContext } from 'react';
import type { MenuFilter, MenuGroup } from './menuTypes';

export interface MenuFiltersValue {
  filters: Set<MenuFilter>;
  query: string;
  collapsed: Set<string>;
  visibleGroups: MenuGroup[];
  toggleFilter: (filter: MenuFilter) => void;
  toggleCategory: (name: string) => void;
  setQuery: (value: string) => void;
  resetFilters: () => void;
}

export const MenuFiltersContext = createContext<MenuFiltersValue | null>(null);

export function useMenuFilters(): MenuFiltersValue {
  const value = useContext(MenuFiltersContext);
  if (!value) throw new Error('useMenuFilters must be used inside MenuFiltersProvider');
  return value;
}
