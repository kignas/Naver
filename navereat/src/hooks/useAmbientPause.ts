import { useEffect, useState, type RefObject } from 'react';
import { overlayOpen } from './useOverlayOpen';
import { subscribeSheetCount } from '../lib/sheetStack';

/**
 * True while looping/idle motion must be held: the page is covered by another
 * route or a sheet, the document is hidden, or the element has scrolled out of
 * view. A held animation writes no styles, which is what keeps a covered Home
 * completely idle on Android.
 */
export function useAmbientPause(ref: RefObject<Element | null>): boolean {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const node = ref.current;
    let offScreen = false;
    let hidden = document.visibilityState === 'hidden';
    let covered = window.location.hash.replace(/^#/, '') !== '/' || overlayOpen();

    const apply = () => setPaused(offScreen || hidden || covered);
    const sync = () => {
      hidden = document.visibilityState === 'hidden';
      covered = window.location.hash.replace(/^#/, '') !== '/' || overlayOpen();
      apply();
    };

    const viewport =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              offScreen = !entry.isIntersecting;
              apply();
            },
            { threshold: 0.02 },
          );
    if (node) viewport?.observe(node);

    // Sheets only announce themselves through body classes or the sheet stack;
    // the router navigates with pushState, so its own events are the coverage
    // signal (`before-navigate` fires before the URL changes, hence the
    // microtask).
    const bodyWatcher = typeof MutationObserver === 'undefined' ? null : new MutationObserver(sync);
    bodyWatcher?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const unsubscribeSheets = subscribeSheetCount(sync);
    const syncSoon = () => queueMicrotask(sync);
    const navEvents = ['navereat:transition-start', 'navereat:transition-end'] as const;
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('navereat:before-navigate', syncSoon);
    navEvents.forEach((name) => window.addEventListener(name, sync));
    document.addEventListener('visibilitychange', sync);

    apply();

    return () => {
      viewport?.disconnect();
      bodyWatcher?.disconnect();
      unsubscribeSheets();
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      window.removeEventListener('navereat:before-navigate', syncSoon);
      navEvents.forEach((name) => window.removeEventListener(name, sync));
      document.removeEventListener('visibilitychange', sync);
    };
  }, [ref]);

  return paused;
}
