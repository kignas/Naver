export type LazyRouteKey = 'restaurant' | 'cart' | 'orders' | 'track' | 'profile' | 'category' | 'under99';

export const routeLoaders = {
  restaurant: () => import('../pages/Restaurant'),
  cart: () => import('../pages/Cart'),
  orders: () => import('../pages/Orders'),
  track: () => import('../pages/Track'),
  profile: () => import('../pages/Profile'),
  category: () => import('../pages/Category'),
  under99: () => import('../pages/Under99'),
} satisfies Record<LazyRouteKey, () => Promise<unknown>>;

export function routeKeyFor(pathname: string): LazyRouteKey | null {
  if (pathname.startsWith('/restaurant/')) return 'restaurant';
  if (pathname === '/cart') return 'cart';
  if (pathname === '/orders') return 'orders';
  if (pathname.startsWith('/track/')) return 'track';
  if (pathname === '/profile') return 'profile';
  if (pathname.startsWith('/category/')) return 'category';
  if (pathname === '/under99') return 'under99';
  return null;
}

export function preloadRoute(pathname: string): Promise<unknown> {
  const key = routeKeyFor(pathname);
  return key ? routeLoaders[key]() : Promise.resolve();
}

export function preloadLikelyRoutes(pathname: string): void {
  const keys: LazyRouteKey[] =
    pathname === '/'
      ? ['restaurant', 'cart']
      : pathname.startsWith('/restaurant/')
        ? ['cart']
        : pathname === '/cart'
          ? ['orders']
          : [];
  keys.forEach((key) => void routeLoaders[key]());
}
