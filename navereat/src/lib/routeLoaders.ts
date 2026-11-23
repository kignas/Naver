import { findRestaurant, restaurants } from '../data/demo';
import { useNavStore } from '../store/navStore';

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
  return Promise.all([routeLoaders[key](), preloadRouteAssets(pathname)]);
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
    scheduleSpeculative(() => void preloadRoute('/orders'));
  }
}
