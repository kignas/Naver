import { useEffect, useRef, useState, type RefObject } from 'react';

export const SEARCH_DISHES = [
  'Biryani',
  'Pizza',
  'Momos',
  'Rolls',
  'Chowmein',
  'Fried Rice',
  'Chicken Biryani',
  'Puchka',
  'Burger',
  'Dosa',
  'Momo',
  'Noodles',
  'Thali',
  'Sweets',
  'Pasta',
] as const;

const FIRST_DELAY_MS = 600;
// Long enough that a page revealed by a pop keeps the text it was showing when
// the user left, instead of changing a beat after the page lands.
const RESUME_DELAY_MS = 1000;
const INITIAL_INTERVAL_MS = 1800;
const INITIAL_TRANSITION_MS = 600;

export function useSearchPlaceholder(
  scrollerRef: RefObject<HTMLElement | null>,
  paused = false,
): {
  dish: string;
  duration: number;
} {
  const [index, setIndex] = useState(0);
  const [duration, setDuration] = useState(INITIAL_TRANSITION_MS);
  // The rotation restarts its effect every time the page is uncovered. Resuming
  // from the dish that is already on screen keeps the header text still on
  // return instead of jumping back to the start of the list.
  const indexRef = useRef(0);
  indexRef.current = index;
  const startedRef = useRef(false);

  useEffect(() => {
    // A covered page must not schedule work: the rotation stops and the effect
    // tears its listeners down until the page is the active route again.
    if (paused) return;
    let current = indexRef.current;
    let transitionMs = INITIAL_TRANSITION_MS;
    let intervalMs = INITIAL_INTERVAL_MS;
    let timer: number | null = null;
    let scrollStopTimer: number | null = null;
    let visibilityTimer: number | null = null;
    let scrollingDown = false;

    const scroller = scrollerRef.current;
    let lastScrollY = scroller?.scrollTop ?? window.scrollY;

    const stopTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = (delay = intervalMs) => {
      stopTimer();
      if (document.hidden || scrollingDown) return;
      timer = window.setTimeout(tick, delay);
    };

    const tick = () => {
      if (document.hidden || scrollingDown) return;
      current = (current + 1) % SEARCH_DISHES.length;
      setIndex(current);
      setDuration(transitionMs);
      transitionMs = Math.min(1100, transitionMs + 100);
      intervalMs = Math.min(3200, intervalMs + 180);
      scheduleNext();
    };

    const handleScroll = () => {
      const y = scroller?.scrollTop ?? window.scrollY;
      const down = y > lastScrollY + 2;
      lastScrollY = y;
      if (!down) return;
      scrollingDown = true;
      stopTimer();
      if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer);
      scrollStopTimer = window.setTimeout(() => {
        scrollingDown = false;
        lastScrollY = scroller?.scrollTop ?? window.scrollY;
        scheduleNext(500);
      }, 900);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopTimer();
        if (visibilityTimer !== null) window.clearTimeout(visibilityTimer);
      } else if (!scrollingDown) {
        if (visibilityTimer !== null) window.clearTimeout(visibilityTimer);
        visibilityTimer = window.setTimeout(() => scheduleNext(300), 300);
      }
    };

    const scrollTarget: HTMLElement | Window = scroller ?? window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    scheduleNext(startedRef.current ? RESUME_DELAY_MS : FIRST_DELAY_MS);
    startedRef.current = true;

    return () => {
      stopTimer();
      if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer);
      if (visibilityTimer !== null) window.clearTimeout(visibilityTimer);
      scrollTarget.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [paused, scrollerRef]);

  return { dish: SEARCH_DISHES[index], duration };
}
