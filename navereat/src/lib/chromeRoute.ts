import { useEffect, useState } from 'react';
import { isTabPath } from './navigation';
import { useNavStore } from '../store/navStore';

/**
 * The pathname the app shell paints with — the floating cart bar and everything
 * else outside the page layers.
 *
 * A detail route is pushed *over* the tab that opened it, and the incoming page
 * only covers the screen at the end of the slide. If the shell followed the
 * router immediately, the Home cart pill would drop from above the nav into its
 * pink restaurant slot (or vanish) while Home is still the only thing on screen.
 * So a push into a detail route keeps the outgoing chrome until the incoming
 * page has finished covering it, exactly like the bottom nav does.
 *
 * Pops and tab switches apply on the render that leaves the detail route: the
 * departing page reveals the tab's own chrome from the first frame of the slide.
 * The push applies on the frame the incoming page starts moving, so the shell
 * changes together with the slide instead of after it has landed.
 */
export function useChromePathname(pathname: string): string {
  const [chromePathname, setChromePathname] = useState(pathname);

  useEffect(() => {
    if (chromePathname === pathname) return;
    const pushing = useNavStore.getState().direction === 'push';
    if (!pushing || isTabPath(pathname)) {
      setChromePathname(pathname);
      return;
    }
    const apply = () => setChromePathname(pathname);
    window.addEventListener('navereat:transition-start', apply, { once: true });
    window.addEventListener('navereat:transition-end', apply, { once: true });
    // A push that never reports its start or end (a deep link straight to a
    // detail route, a dropped frame) must not strand the chrome on the old
    // screen.
    const fallback = window.setTimeout(apply, 1200);
    return () => {
      window.removeEventListener('navereat:transition-start', apply);
      window.removeEventListener('navereat:transition-end', apply);
      window.clearTimeout(fallback);
    };
  }, [chromePathname, pathname]);

  return chromePathname;
}
