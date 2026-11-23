import { useEffect, useRef, type RefObject } from 'react';

interface ScrollHeaderMotionOptions {
  /** The element that scrolls the page. */
  scroller: RefObject<HTMLElement | null>;
  /** The element that owns the --hp / --hsy custom properties. */
  host: RefObject<HTMLElement | null>;
  /** Called (throttled) with the scroll offset so the tab can restore it. */
  onScrollTop?: (top: number) => void;
}

const FALLBACK_DISTANCE = 59;
const STORE_STEP = 24;
const IDLE_MS = 160;
// The hero art is clipped by the banner, so its parallax is capped in CSS;
// stop recomputing the shift once the cap is reached.
const PARALLAX_LIMIT = 220;

/**
 * Drives the Home header collapse from a single passive listener and one rAF
 * per frame. The listener only schedules work; scrollTop is read inside the
 * frame, and the collapse distance is measured once (plus on resize) so no
 * layout is read while the finger is moving.
 *
 * Returns a function that re-syncs after a programmatic scroll restore.
 */
export function useScrollHeaderMotion({ scroller, host, onScrollTop }: ScrollHeaderMotionOptions): () => void {
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const scrollEl = scroller.current;
    const hostEl = host.current;
    if (!scrollEl || !hostEl) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const searchRow = scrollEl.querySelector<HTMLElement>('.search-row');
    const header = scrollEl.querySelector<HTMLElement>('.hero-header');
    let distance = searchRow?.offsetTop || FALLBACK_DISTANCE;
    let headerHeight = header?.offsetHeight ?? 0;

    let frame = 0;
    let idle = 0;
    let stored = -1;
    let lastProgress = -1;
    let lastShift = -1;
    let lastCollapsed = false;

    const apply = () => {
      frame = 0;
      const top = scrollEl.scrollTop;
      const progress = reduced?.matches ? 0 : Math.min(1, Math.max(0, top / distance));
      // Once the header has scrolled away both values are clamped, so stop
      // writing: a custom property write invalidates the whole header subtree.
      const shift = Math.round(Math.min(top, PARALLAX_LIMIT));
      // The transform only exists once the header starts collapsing: at rest
      // the elements must stay untransformed so the page renders (and
      // rasterises) exactly like the original.
      const collapsed = progress > 0;
      if (collapsed !== lastCollapsed) {
        lastCollapsed = collapsed;
        hostEl.classList.toggle('is-header-collapsed', collapsed);
      }
      if (Math.abs(progress - lastProgress) > 0.001) {
        lastProgress = progress;
        hostEl.style.setProperty('--hp', progress.toFixed(3));
      }
      if (shift !== lastShift) {
        lastShift = shift;
        hostEl.style.setProperty('--hsy', String(shift));
      }
      if (Math.abs(top - stored) >= STORE_STEP) {
        stored = top;
        onScrollTop?.(top);
      }
      if (top > headerHeight + 240 && hostEl.classList.contains('is-header-motion')) {
        hostEl.classList.remove('is-header-motion');
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const measure = () => {
      const next = searchRow?.offsetTop ?? 0;
      if (next > 0) distance = next;
      headerHeight = header?.offsetHeight ?? headerHeight;
      schedule();
    };

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

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(scrollEl);
    if (header) observer?.observe(header);

    syncRef.current = () => {
      measure();
      apply();
    };
    apply();

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(idle);
      hostEl.classList.remove('is-header-motion');
      syncRef.current = () => {};
    };
  }, [host, onScrollTop, scroller]);

  return () => syncRef.current();
}
