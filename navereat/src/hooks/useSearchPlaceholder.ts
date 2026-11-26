import { useEffect, useState, type RefObject } from 'react';

export const SEARCH_DISHES = ['Pizza', 'Biryani', 'Dosa', 'Chai', 'Momos'] as const;

const INTERVAL_MS = 2500;
// A downward fling is the one moment a text swap costs frames; hold the cycle
// until the feed settles.
const SCROLL_SETTLE_MS = 800;

/**
 * The rolling search term. Isolated in its own component so a tick re-renders
 * one span instead of the Home page, and paused whenever Home is covered, the
 * document is hidden or the user is scrolling.
 */
export function useSearchPlaceholder(
  scrollerRef: RefObject<HTMLElement | null>,
  paused = false,
): { dish: string } {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused) return;

    let timer: number | null = null;
    let settleTimer: number | null = null;
    let scrolling = false;
    let lastY = scrollerRef.current?.scrollTop ?? window.scrollY;

    const stop = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      stop();
      if (document.hidden) return;
      timer = window.setTimeout(() => {
        if (document.hidden || scrolling) {
          schedule();
          return;
        }
        setIndex((current) => (current + 1) % SEARCH_DISHES.length);
        schedule();
      }, INTERVAL_MS);
    };

    const onScroll = () => {
      const y = scrollerRef.current?.scrollTop ?? window.scrollY;
      const down = y > lastY + 2;
      lastY = y;
      if (!down) return;
      scrolling = true;
      stop();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        scrolling = false;
        lastY = scrollerRef.current?.scrollTop ?? window.scrollY;
        schedule();
      }, SCROLL_SETTLE_MS);
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else schedule();
    };

    const scrollTarget: HTMLElement | Window = scrollerRef.current ?? window;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      stop();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      scrollTarget.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [paused, scrollerRef]);

  return { dish: SEARCH_DISHES[index] };
}
