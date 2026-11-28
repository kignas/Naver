/**
 * The app paints to the physical bottom of the screen and the floating nav is
 * pinned a fixed 54k above the *visible* bottom, not above the layout
 * viewport. The two are not the same on Android Chrome: while the browser's own
 * bottom UI is on screen, `visualViewport.height` is shorter than
 * `window.innerHeight`, and the layout viewport keeps its height. A shell sized
 * with `100dvh`/`100%` then ends short and leaves a bare strip under the last
 * scrollable row.
 *
 * `--vvh` is the height to size the shell with, `--vv-gap` is how much of the
 * layout viewport the user cannot see at the bottom (the chrome offsets use it
 * so they stay 54k above what is actually visible), and `--vv-top` is the
 * visible top offset when the visual viewport is shifted (keyboard).
 */
export function installViewportVars(): () => void {
  const root = document.documentElement;

  const sync = () => {
    const visual = window.visualViewport;
    const viewportHeight = visual ? visual.height : window.innerHeight;
    const visibleBottom = visual ? visual.height + visual.offsetTop : window.innerHeight;
    const gap = Math.max(0, Math.round(window.innerHeight - visibleBottom));
    root.style.setProperty('--vvh', `${Math.round(viewportHeight)}px`);
    root.style.setProperty('--vv-gap', `${gap}px`);
    root.style.setProperty('--vv-top', `${Math.max(0, Math.round(visual?.offsetTop ?? 0))}px`);
  };

  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  window.visualViewport?.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('scroll', sync);

  return () => {
    window.removeEventListener('resize', sync);
    window.removeEventListener('orientationchange', sync);
    window.visualViewport?.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('scroll', sync);
  };
}
