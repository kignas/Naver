import { Flip } from './gsap';

/** Same `data-flip-id` on the Home card and the restaurant header. */
export const restaurantHeroId = (id: number | string) => `restaurant-hero-${id}`;
/** Same `data-flip-id` on the Home search pill and the search input box. */
export const SEARCH_FLIP_ID = 'home-search';

/** A captured state is only meaningful for the navigation it was taken for. */
const TTL_MS = 900;

interface PendingFlip {
  id: string;
  state: Flip.FlipState;
  at: number;
}

let pending: PendingFlip | null = null;

export function captureFlip(id: string, element: Element | null): void {
  if (!element) return;
  // simple: only the box is recorded. The shared elements are plain cards, and
  // the extra property sweep costs a forced layout inside the tap frame.
  pending = { id, state: Flip.getState(element, { simple: true }), at: performance.now() };
}

/**
 * Press-time capture. The tap frame must stay short, so the box is read on
 * pointerdown instead of inside the click handler, where the route commit is
 * already waiting on the main thread.
 */
export function installFlipOriginCapture(): () => void {
  const onDown = (event: PointerEvent) => {
    const element = (event.target as Element | null)?.closest?.('[data-flip-origin]');
    if (!(element instanceof HTMLElement)) return;
    const id = element.dataset.flipOrigin;
    if (id) captureFlip(id, element);
  };
  document.addEventListener('pointerdown', onDown, { passive: true, capture: true });
  return () => document.removeEventListener('pointerdown', onDown, { capture: true });
}

export function takeFlip(id: string): PendingFlip | null {
  if (!pending || pending.id !== id) return null;
  const taken = pending;
  pending = null;
  return performance.now() - taken.at < TTL_MS ? taken : null;
}

/**
 * Detail pages mount a skeleton first and swap in the real page a frame or two
 * later, which replaces the node the shared-element animation started on.
 * Anything captured inside this window may start again on the new node.
 */
export function isFlipFresh(at: number): boolean {
  return performance.now() - at < 500;
}
