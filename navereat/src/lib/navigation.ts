import { useMemo } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useNavStore } from '../store/navStore';
import { preloadRoute } from './routeLoaders';

export const TAB_PATHS = ['/', '/under99', '/orders', '/profile'] as const;

export const isTabPath = (pathname: string): boolean =>
  (TAB_PATHS as readonly string[]).includes(pathname);

let navigateRef: NavigateFunction | null = null;

/** Keeps the router context out of every page component that only needs actions. */
export function NavBridge(): null {
  navigateRef = useNavigate();
  return null;
}

const notifyBeforeNavigate = (): void => {
  try {
    window.dispatchEvent(new CustomEvent('navereat:before-navigate'));
  } catch {
    /* non-browser test environment */
  }
};

const go = (to: string, direction: 'push' | 'tab'): void => {
  // Never put network/chunk decoding in front of the transition. The route
  // shell is the first paint; the chunk can finish while it slides.
  void preloadRoute(to);
  if (direction === 'push') notifyBeforeNavigate();
  useNavStore.getState().setDirection(direction);
  navigateRef?.(to);
};

const actions = {
  push: (to: string) => go(to, 'push'),
  tab: (to: string) => go(to, 'tab'),
  back: () => {
    notifyBeforeNavigate();
    useNavStore.getState().setDirection('pop');
    navigateRef?.(-1);
  },
  replace: (to: string) => {
    notifyBeforeNavigate();
    useNavStore.getState().setDirection('pop');
    navigateRef?.(to, { replace: true });
  },
  reset: (to: string) => {
    useNavStore.getState().setDirection('tab');
    navigateRef?.(to, { replace: true });
  },
};

/** Stable action object; pages do not need to re-render when the router moves. */
export function useAppNav() {
  return useMemo(() => actions, []);
}
