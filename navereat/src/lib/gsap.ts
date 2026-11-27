import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

export { gsap, Flip };

/** Android "Remove animations" / iOS Reduce Motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Page motion: quick out of the gate, long soft landing. */
export const PAGE_EASE = 'power3.out';
export const PAGE_PUSH_DURATION = 0.3;
export const PAGE_POP_DURATION = 0.26;

/** How far the page underneath travels while a detail page slides over it. */
export const PARALLAX_PERCENT = -25;

/** Sheets drop in from below and leave the way they came. */
export const SHEET_EASE = 'power3.out';
export const SHEET_IN_DURATION = 0.34;
export const SHEET_OUT_DURATION = 0.24;

const TAP_TARGETS = [
  '.u99-restaurant-card',
  '.u99-item',
  '.u99-add',
  '.add-btn-wrap button',
  '.nb-qty-btn',
  '.filter-pill',
  '.ct-btn',
  '.search-box',
  '.veg-box',
  '.sheet-done',
].join(',');

/**
 * Tactile press feedback for cards, chips and ADD buttons. One delegated
 * listener instead of a component per row: the feed renders hundreds of nodes
 * and none of them should pay for a motion wrapper.
 */
export function installTapFeedback(): () => void {
  if (prefersReducedMotion()) return () => {};
  let active: HTMLElement | null = null;

  const release = () => {
    if (!active) return;
    const element = active;
    active = null;
    gsap.to(element, { scale: 1, duration: 0.2, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' });
  };

  const onDown = (event: PointerEvent) => {
    const element = (event.target as Element | null)?.closest?.(TAP_TARGETS);
    if (!(element instanceof HTMLElement) || element.hasAttribute('data-tap-fx-off')) return;
    release();
    active = element;
    gsap.to(element, { scale: 0.97, duration: 0.1, ease: 'power2.out', overwrite: 'auto' });
  };

  document.addEventListener('pointerdown', onDown, { passive: true, capture: true });
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', release, { passive: true });

  return () => {
    document.removeEventListener('pointerdown', onDown, { capture: true });
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
    if (active) gsap.killTweensOf(active);
  };
}
