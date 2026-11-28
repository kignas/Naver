import type { ComponentType } from 'react';
import { findRestaurant, restaurants } from '../data/demo';
import { useNavStore } from '../store/navStore';

export type LazyRouteKey =
  | 'restaurant'
  | 'cart'
  | 'orders'
  | 'track'
  | 'profile'
  | 'category'
  | 'under99'
  | 'payment'
  | 'address';

const NAMED_EXPORTS: Record<LazyRouteKey, string> = {
  restaurant: 'Restaurant',
  cart: 'Cart',
  orders: 'Orders',
  track: 'Track',
  profile: 'Profile',
  category: 'Category',
  under99: 'Under99',
  payment: 'PaymentResult',
  address: 'Address',
};

export const routeLoaders = {
  restaurant: () => import('../pages/Restaurant'),
  cart: () => import('../pages/Cart'),
  orders: () => import('../pages/Orders'),
  track: () => import('../pages/Track'),
  profile: () => import('../pages/Profile'),
  category: () => import('../pages/Category'),
  under99: () => import('../pages/Under99'),
  payment: () => import('../pages/PaymentResult'),
  address: () => import('../pages/Address'),
} satisfies Record<LazyRouteKey, () => Promise<unknown>>;

const components = new Map<LazyRouteKey, ComponentType>();
const componentLoads = new Map<LazyRouteKey, Promise<ComponentType | null>>();

/**
 * The page component for a route, or null while its chunk is still loading.
 *
 * Routes are not `React.lazy` on purpose. A lazy component suspends even when
 * its module is already in memory, so the first visit rendered the route shell
 * and then the real page — two commits, and the slide had to wait for the
 * second one. Remembering the resolved component lets a preloaded route paint
 * in its first commit.
 */
export function routeComponent(key: LazyRouteKey): ComponentType | null {
  return components.get(key) ?? null;
}

export function loadRouteComponent(key: LazyRouteKey): Promise<ComponentType | null> {
  const cached = components.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = componentLoads.get(key);
  if (pending) return pending;
  const load = routeLoaders[key]()
    .then((module) => {
      const record = module as Record<string, ComponentType | undefined>;
      const component = record[NAMED_EXPORTS[key]] ?? record.default ?? null;
      if (component) components.set(key, component);
      componentLoads.delete(key);
      return component;
    })
    .catch((error: unknown) => {
      // A failed chunk must not be remembered: the rejected promise used to be
      // cached for the rest of the session, so one dropped request (or a chunk
      // name that no longer exists after a redeploy) made every later tap on
      // that route land on the loading shell forever.
      componentLoads.delete(key);
      throw error;
    });
  componentLoads.set(key, load);
  return load;
}

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

const imageCache = new Set<string>();
const imagePromises = new Map<string, Promise<void>>();

function preloadImage(src: string): Promise<void> {
  if (imageCache.has(src)) return Promise.resolve();
  const existing = imagePromises.get(src);
  if (existing) return existing;
  if (typeof Image === 'undefined') return Promise.resolve();
  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      imageCache.add(src);
      imagePromises.delete(src);
      void image.decode().catch(() => undefined).finally(resolve);
    };
    image.onerror = () => {
      imagePromises.delete(src);
      resolve();
    };
    image.src = src;
  });
  imagePromises.set(src, promise);
  return promise;
}

/** Warms the images used by the target route while the current page is idle. */
export function preloadRouteAssets(pathname: string): Promise<void> {
  const images = new Set<string>();
  if (pathname.startsWith('/restaurant/')) {
    const restaurant = findRestaurant(pathname.split('/')[2]);
    if (restaurant) {
      if (restaurant.image) images.add(restaurant.image);
      restaurant.menu.forEach((item) => {
        if (item.image) images.add(item.image);
      });
    }
  } else if (pathname === '/cart' || pathname === '/orders' || pathname.startsWith('/track/')) {
    restaurants.forEach((restaurant) => {
      if (restaurant.image) images.add(restaurant.image);
    });
  }
  return Promise.all([...images].map(preloadImage)).then(() => undefined);
}

export function preloadRoute(pathname: string): Promise<unknown> {
  const key = routeKeyFor(pathname);
  if (!key) return Promise.resolve();
  // Images must never gate a tap: the route shell frames the slide while they
  // decode in the background.
  void preloadRouteAssets(pathname);
  // A speculative preload never surfaces an error of its own; the route's own
  // render asks for the chunk again and shows the retry screen if it fails.
  return loadRouteComponent(key).catch(() => null);
}

/** Loads every route chunk once, after the first screen has painted. */
export function preloadAllRoutes(): void {
  (Object.keys(routeLoaders) as LazyRouteKey[]).forEach((key) => {
    void loadRouteComponent(key).catch(() => null);
  });
}

/** Starts the target chunk and its images as soon as the user touches a card. */
export function installPreloadOnIntent(): () => void {
  const onIntent = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const route = target.closest('[data-preload-route]')?.getAttribute('data-preload-route');
    if (route) void preloadRoute(route);
  };
  window.addEventListener('pointerdown', onIntent, { capture: true, passive: true });
  window.addEventListener('touchstart', onIntent, { capture: true, passive: true });
  return () => {
    window.removeEventListener('pointerdown', onIntent, true);
    window.removeEventListener('touchstart', onIntent, true);
  };
}

function scheduleSpeculative(task: () => void): void {
  const run = () => {
    if (useNavStore.getState().preparing) {
      window.addEventListener('navereat:transition-end', run, { once: true });
      return;
    }
    task();
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    window.setTimeout(run, 300);
  }
}

export function preloadLikelyRoutes(pathname: string): void {
  // Only one speculative chunk at a time. Starting the next chunk while a
  // slide is running is what used to show up as a 60 ms gap in push FPS.
  if (pathname === '/') {
    scheduleSpeculative(() => void preloadRoute('/restaurant/1'));
    return;
  }
  if (pathname.startsWith('/restaurant/')) {
    scheduleSpeculative(() => void preloadRoute('/cart'));
    return;
  }
  if (pathname === '/cart') {
    scheduleSpeculative(() => void preloadRoute('/track/demo'));
  }
}
