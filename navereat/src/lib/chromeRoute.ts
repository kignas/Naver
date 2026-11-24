import { useEffect, useState } from 'react';
import { isTabPath } from './navigation';
import { useNavStore } from '../store/navStore';

/**
 * The pathname the app shell paints with — the floating cart bar and everything
 * else outside the page layers.
 *
 * A detail route is pushed *over* the tab that opened it, and the incoming page
 * only covers the screen at the end of the slide. The shell must keep painting
 * the outgoing tab's chrome for the whole slide: the floating nav stays docked
 * on that tab, so swapping the cart pill into its docked detail slot (or into
 * the restaurant's pink bar) at the first frame would move the bar out from
 * under a Home that is still the only page on screen. The shell therefore
 * follows the router at `transition-end`, in the same commit that takes the nav
 * away, i.e. only once the incoming page covers both. The pill's slot change is
 * a compositor transform, so that swap emits no layout shift.
 *
 * Pops and tab switches apply on the render that leaves the detail route: the
 * departing page reveals the tab's own chrome from the first frame of the slide.
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
    window.addEventListener('navereat:transition-end', apply, { once: true });
    // A push that never reports its end (a deep link straight to a detail
    // route, a dropped frame) must not strand the chrome on the old screen.
    const fallback = window.setTimeout(apply, 1200);
    return () => {
      window.removeEventListener('navereat:transition-end', apply);
      window.clearTimeout(fallback);
    };
  }, [chromePathname, pathname]);

  return chromePathname;
}
