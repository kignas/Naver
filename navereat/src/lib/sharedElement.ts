import { Flip } from './gsap';

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
  // simple: only the box is recorded. The extra property sweep would cost a
  // forced layout inside the tap frame.
  pending = { id, state: Flip.getState(element, { simple: true }), at: performance.now() };
}

export function takeFlip(id: string): PendingFlip | null {
  if (!pending || pending.id !== id) return null;
  const taken = pending;
  pending = null;
  return performance.now() - taken.at < TTL_MS ? taken : null;
}
