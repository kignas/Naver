/**
 * Scroll-driven hide/show for the floating tab bar (and, through the same body
 * class, the cart bar).
 *
 * One passive scroll listener per tab scroller and one rAF per frame. The
 * handler only reads `scrollTop` (a cached value, no layout) and toggles a
 * class on <body>, so the bar and the cart bar move on the compositor and React
 * never re-renders. The scroller's scrollable range is measured when it is
 * attached, on resize, when a scroll settles and when the feed repaints — never
 * inside the scroll handler.
 *
 * State machine: accumulate travel in the scroll direction; crossing the
 * threshold flips the state and resets the accumulator. Travel that cannot
 * scroll further (top/bottom rubber-band) is clamped away, so bounce never
 * hides the bar.
 */

/** Travel needed before the bar moves, in px. */
const HIDE_AFTER = 12;
/** The bar is always on screen this close to the top. */
const TOP_ALWAYS_VISIBLE = 40;
/** A scroll this quiet is treated as settled; the range is re-measured. */
const SETTLE_MS = 160;

export const NAV_SCROLL_HIDDEN_CLASS = 'nav-scroll-hidden';
/** Set while a reset must not animate (route change). */
export const NAV_SCROLL_RESET_CLASS = 'nav-scroll-reset';

export interface NavScrollHide {
  /** Starts following a scroller (null detaches and shows the bar). */
  attach(scroller: HTMLElement | null): void;
  detach(): void;
  /** Shows the bar. `instant` also removes the transition for that frame. */
  reset(instant?: boolean): void;
  /** Freezes the state while something owns the screen (a drag, a sheet). */
  suspend(reason: string, on: boolean): void;
  hidden(): boolean;
  /** Re-reads the scroller's range; call after content changes. */
  measure(): void;
}

export function createNavScrollHide(): NavScrollHide {
  let scroller: HTMLElement | null = null;
  let frame = 0;
  let settle = 0;
  let range = 0;
  let lastTop = 0;
  let accum = 0;
  let hidden = false;
  let resetFrame = 0;
  const suspended = new Set<string>();

  const write = (next: boolean): void => {
    if (next === hidden) return;
    hidden = next;
    document.body.classList.toggle(NAV_SCROLL_HIDDEN_CLASS, next);
    window.dispatchEvent(new CustomEvent('navereat:nav-scroll', { detail: { hidden: next } }));
  };

  const measure = (): void => {
    if (!scroller) {
      range = 0;
      return;
    }
    range = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  };

  const apply = (): void => {
    frame = 0;
    if (!scroller) return;
    // Rubber-band positions report values outside the scrollable range; they
    // are not travel, so clamp before taking the delta.
    const top = Math.min(Math.max(scroller.scrollTop, 0), Math.max(range, 0));
    const delta = top - lastTop;
    lastTop = top;

    if (suspended.size > 0 || range <= 0 || top < TOP_ALWAYS_VISIBLE) {
      accum = 0;
      write(false);
      return;
    }
    accum += delta;
    if (accum >= HIDE_AFTER) {
      accum = 0;
      write(true);
    } else if (accum <= -HIDE_AFTER) {
      accum = 0;
      write(false);
    }
  };

  const schedule = (): void => {
    if (!frame) frame = window.requestAnimationFrame(apply);
  };

  const onScroll = (): void => {
    schedule();
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      measure();
      schedule();
    }, SETTLE_MS);
  };

  const onResize = (): void => {
    measure();
    schedule();
  };

  const clearReset = (): void => {
    resetFrame = 0;
    document.body.classList.remove(NAV_SCROLL_RESET_CLASS);
  };

  const reset = (instant = false): void => {
    accum = 0;
    if (scroller) lastTop = Math.min(Math.max(scroller.scrollTop, 0), Math.max(range, 0));
    if (instant) {
      document.body.classList.add(NAV_SCROLL_RESET_CLASS);
      window.clearTimeout(resetFrame);
      // Two frames: the transition is off while the class change paints, and
      // the next hide still animates.
      resetFrame = window.setTimeout(clearReset, 48);
    }
    write(false);
  };

  const detach = (): void => {
    if (scroller) scroller.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    scroller = null;
    range = 0;
    accum = 0;
    lastTop = 0;
    window.clearTimeout(settle);
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const attach = (next: HTMLElement | null): void => {
    detach();
    if (!next) {
      write(false);
      return;
    }
    scroller = next;
    measure();
    lastTop = Math.min(Math.max(next.scrollTop, 0), range);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    schedule();
  };

  const suspend = (reason: string, on: boolean): void => {
    if (on) {
      suspended.add(reason);
      accum = 0;
      write(false);
    } else {
      suspended.delete(reason);
    }
  };

  return {
    attach,
    detach,
    reset,
    suspend,
    hidden: () => hidden,
    measure: () => {
      measure();
      schedule();
    },
  };
}

/** The app has exactly one tab bar, so the controller is a singleton. */
export const navScrollHide = createNavScrollHide();
