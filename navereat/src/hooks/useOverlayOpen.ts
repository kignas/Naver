import { useEffect, useState, useSyncExternalStore } from 'react';
import { subscribeSheetCount, sheetCount } from '../lib/sheetStack';

const OVERLAY_CLASSES = [
  'nb-sheet-open',
  'ewcs-custom-open',
  'u99-cust-open',
  'filter-sheet-open',
  'ct-sheet-open',
  'u99-modal-open',
];

const bodyHasOverlay = (): boolean => OVERLAY_CLASSES.some((name) => document.body.classList.contains(name));

/** The overlay signal without a subscription: used by class-driven pauses. */
export const overlayOpen = (): boolean => sheetCount() > 0 || bodyHasOverlay();

/**
 * True while a sheet, the search overlay or another modal owns the screen.
 * Legacy sheets only announce themselves through body classes, so the body
 * class list is observed rather than polled.
 */
export function useOverlayOpen(): boolean {
  const [sheetOpen, setSheetOpen] = useState(() => sheetCount() > 0);
  const [bodyOpen, setBodyOpen] = useState(bodyHasOverlay);

  useEffect(() => {
    const unsubscribe = subscribeSheetCount(() => setSheetOpen(sheetCount() > 0));
    const observer = new MutationObserver(() => setBodyOpen(bodyHasOverlay()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  return sheetOpen || bodyOpen;
}

/**
 * The router location a *tab cache* sees is the one it was cached with, so a
 * covered page cannot learn from `useLocation` that it is covered. The hash is
 * the one signal every layer shares.
 *
 * React Router navigates with `history.pushState`, which fires neither
 * `hashchange` nor `popstate`; the app's own navigation events close that gap.
 * `before-navigate` lands before the push, so it notifies on a microtask, once
 * the new hash is in the URL.
 */
const NAV_EVENTS = ['navereat:transition-start', 'navereat:transition-end'] as const;

const subscribeHash = (listener: () => void): (() => void) => {
  const notifySoon = () => queueMicrotask(listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  window.addEventListener('navereat:before-navigate', notifySoon);
  NAV_EVENTS.forEach((name) => window.addEventListener(name, listener));
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
    window.removeEventListener('navereat:before-navigate', notifySoon);
    NAV_EVENTS.forEach((name) => window.removeEventListener(name, listener));
  };
};

const readHash = (): string => window.location.hash;

export function useHashPath(): string {
  const hash = useSyncExternalStore(subscribeHash, readHash, readHash);
  return hash.replace(/^#/, '') || '/';
}
