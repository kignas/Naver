import { useEffect, useRef, type RefObject } from 'react';

interface ScrollHeaderMotionOptions {
  /** The element that scrolls the page. */
  scroller: RefObject<HTMLElement | null>;
  /** The screen root; carries the is-header-* state classes. */
  host: RefObject<HTMLElement | null>;
  /** The sticky pin block; used to measure the distance below the location row. */
  header: RefObject<HTMLElement | null>;
  /** Called (throttled) with the scroll offset so the tab can restore it. */
  onScrollTop?: (top: number) => void;
}

const FALLBACK_PIN_TOP = 59;
const STORE_STEP = 24;
const IDLE_MS = 160;

/**
 * Drives the Home header from a single passive listener and one rAF per frame.
 * The listener only schedules work; scrollTop is read inside the frame, and the
 * pin distance is measured once (plus on resize) so no layout is read while the
 * finger is moving.
 *
 * The pin itself is CSS: `.hero-header` is `position: sticky` with a negative
 * `top` equal to --pin-top, so the location row scrolls out of view and the
 * search row stays glued to the top for the whole page. This hook only writes
 * that distance plus the collapse progress.
 *
 * Returns a function that re-syncs after a programmatic scroll restore.
 */
export function useScrollHeaderMotion({ scroller, host, header, onScrollTop }: ScrollHeaderMotionOptions): () => void {
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const scrollEl = scroller.current;
    const hostEl = host.current;
    if (!scrollEl || !hostEl) return;

    // The custom properties live on the document root so a route transition
    // (which freezes and restores inline styles inside the page) cannot put a
    // stale collapse back.
    const varsEl = document.documentElement;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const searchRow = scrollEl.querySelector<HTMLElement>('.search-row');
    const pinBlock = header.current ?? scrollEl.querySelector<HTMLElement>('.hero-header');

    let pinTop = FALLBACK_PIN_TOP;
    let frame = 0;
    let idle = 0;
    let stored = -1;
    let lastProgress = -1;
    let lastCollapsed = false;

    const apply = () => {
      frame = 0;
      const top = scrollEl.scrollTop;
      const progress = reduced?.matches ? 0 : Math.min(1, Math.max(0, top / pinTop));
      // Once the header has scrolled away the value is clamped, so stop
      // writing: a custom property write invalidates the whole header subtree.
      // The transforms only exist once the header starts collapsing: at rest
      // the elements must stay untransformed so the page renders (and
      // rasterises) exactly like the original.
      const collapsed = progress > 0;
      if (collapsed !== lastCollapsed) {
        lastCollapsed = collapsed;
        hostEl.classList.toggle('is-header-collapsed', collapsed);
      }
      if (Math.abs(progress - lastProgress) > 0.001) {
        lastProgress = progress;
        varsEl.style.setProperty('--hp', progress.toFixed(3));
      }
      if (Math.abs(top - stored) >= STORE_STEP) {
        stored = top;
        onScrollTop?.(top);
      }
      if (top > pinTop + 900 && hostEl.classList.contains('is-header-motion')) {
        hostEl.classList.remove('is-header-motion');
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const measure = () => {
      if (searchRow && pinBlock) {
        const next = Math.round(searchRow.getBoundingClientRect().top - pinBlock.getBoundingClientRect().top);
        if (next > 0 && next !== pinTop) {
          pinTop = next;
          varsEl.style.setProperty('--pin-top', `${next}px`);
        }
      }
      schedule();
    };

    varsEl.style.setProperty('--pin-top', `${pinTop}px`);

    const onScroll = () => {
      if (!hostEl.classList.contains('is-header-motion')) hostEl.classList.add('is-header-motion');
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        hostEl.classList.remove('is-header-motion');
        stored = scrollEl.scrollTop;
        onScrollTop?.(stored);
      }, IDLE_MS);
      schedule();
    };

    // Coming back to this screen (from a pushed route, the background or the
    // back/forward cache) can leave the collapse behind the real scroll offset:
    // the browser restores the offset without firing a scroll event.
    const resync = () => {
      // A cached tab reports scrollTop 0 while it is hidden behind another
      // route, so re-sync only when this screen is actually on screen.
      if (document.visibilityState === 'hidden') return;
      if (window.getComputedStyle(scrollEl).visibility === 'hidden') return;
      measure();
      apply();
    };

    // The route transition freezes the outgoing page's inline styles and puts
    // them back when it ends, which also puts back a stale --hp. Re-sync on the
    // next frame so this write lands after that restore.
    const resyncNextFrame = () => {
      window.requestAnimationFrame(resync);
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pageshow', resync);
    window.addEventListener('navereat:transition-end', resyncNextFrame);
    document.addEventListener('visibilitychange', resync);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(scrollEl);
    if (pinBlock) observer?.observe(pinBlock);

    syncRef.current = resync;
    resync();

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('pageshow', resync);
      window.removeEventListener('navereat:transition-end', resyncNextFrame);
      document.removeEventListener('visibilitychange', resync);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(idle);
      hostEl.classList.remove('is-header-motion');
      syncRef.current = () => {};
    };
  }, [header, host, onScrollTop, scroller]);

  return () => syncRef.current();
}
