import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUiStore } from '../../store/uiStore';
import { MenuFiltersContext, type MenuFiltersValue } from './menuFiltersContext';
import type { MenuFilter, MenuGroup } from './menuTypes';

interface MenuFiltersProviderProps {
  groups: MenuGroup[];
  rating: number;
  routeId: number;
  preparing: boolean;
  initialFilters?: string[];
  initialQuery?: string;
  initialCollapsed?: string[];
  children: ReactNode;
}

/**
 * Owns the filter, search and collapse state below the page, so a chip tap or a
 * keystroke re-renders only the consumers (search row, chips, category nav,
 * dish list) instead of the whole menu screen. `children` are created by the
 * page and keep their identity while this state changes, so React skips them.
 */
export function MenuFiltersProvider({
  groups,
  rating,
  routeId,
  preparing,
  initialFilters,
  initialQuery,
  initialCollapsed,
  children,
}: MenuFiltersProviderProps) {
  const [filters, setFilters] = useState<Set<MenuFilter>>(() => new Set((initialFilters ?? []) as MenuFilter[]));
  const [query, setQuery] = useState(initialQuery ?? '');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(initialCollapsed ?? []));
  const patchRestaurant = useUiStore((state) => state.patchRestaurant);

  const visibleGroups = useMemo(() => {
    const search = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((menuItem) => {
          if (filters.has('popular') && !menuItem.bestseller) return false;
          if (filters.has('rating') && Number(rating ?? 0) < 4) return false;
          if (filters.has('price') && (menuItem.price < 99 || menuItem.price > 149)) return false;
          if (filters.has('veg') && !menuItem.isVeg) return false;
          if (filters.has('nonveg') && menuItem.isVeg) return false;
          if (search && !`${menuItem.name} ${menuItem.desc}`.toLowerCase().includes(search)) return false;
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [filters, groups, query, rating]);

  const value = useMemo<MenuFiltersValue>(
    () => ({
      filters,
      query,
      collapsed,
      visibleGroups,
      toggleFilter: (filter) =>
        setFilters((current) => {
          const next = new Set(current);
          if (next.has(filter)) next.delete(filter);
          else next.add(filter);
          return next;
        }),
      toggleCategory: (name) =>
        setCollapsed((current) => {
          const next = new Set(current);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return next;
        }),
      setQuery,
      resetFilters: () => {
        setFilters(new Set());
        setQuery('');
      },
    }),
    [collapsed, filters, query, visibleGroups],
  );

  useEffect(() => {
    if (!Number.isFinite(routeId) || preparing) return;
    patchRestaurant(routeId, { filters: [...filters], query, collapsed: [...collapsed] });
  }, [collapsed, filters, patchRestaurant, preparing, query, routeId]);

  return <MenuFiltersContext.Provider value={value}>{children}</MenuFiltersContext.Provider>;
}
