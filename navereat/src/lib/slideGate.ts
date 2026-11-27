/**
 * A route page that mounts during a push/pop has to keep its heavy DOM out of
 * the slide. PageTransition marks the slide active before the incoming layer
 * commits and announces completion from the tween's onComplete (plus one
 * frame), so the page can mount the rest then without watching the stage class.
 */
export const SLIDE_COMPLETE_EVENT = 'navereat:slide-complete';

let slideActive = false;

export function markSlideActive(active: boolean): void {
  slideActive = active;
}

export function isSlideActive(): boolean {
  return slideActive;
}

export function announceSlideComplete(): void {
  window.dispatchEvent(new CustomEvent(SLIDE_COMPLETE_EVENT));
}
