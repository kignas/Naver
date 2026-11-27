import tabIsolationCss from '../styles/tab-isolation.css?raw';

export interface RouteStyleSheet {
  attach: () => () => void;
}

interface RegisteredSheet {
  /** Enables or disables the sheet from its holders and its tab layer. */
  apply: () => void;
  routePath: string;
}

const registeredSheets = new Set<RegisteredSheet>();

/**
 * Cached tab routes stay mounted after the first visit, so their stylesheet would
 * keep applying to whichever tab is on screen and override that page's own rules
 * (it doubles `main` padding and rewrites shared classes such as `.filter-pill`).
 * A sheet may only apply while its tab layer is the active one.
 */
export function syncRouteStyleSheets(): void {
  for (const entry of registeredSheets) entry.apply();
}

/**
 * Parses a large raw route stylesheet when its chunk loads (the idle
 * preloader), keeps it disabled, and only enables it for the route's lifetime.
 * The parse happens once; mount never parses or creates a stylesheet.
 *
 * The tab-isolation rules ride at the end of every bundle: they are the last
 * word on the tab layer's inherited typography, so a pushed route cannot
 * restyle the tab it covers. See styles/tab-isolation.css.
 */
export function createRouteStyleSheet(css: string, marker: string, routePath?: string): RouteStyleSheet {
  const style = document.createElement('style');
  style.dataset[marker] = 'true';
  style.media = 'not all';
  style.textContent = `${css}\n${tabIsolationCss}`;
  document.head.appendChild(style);
  // Force the CSS parser to run now, while the route chunk is being preloaded.
  void style.sheet?.cssRules;

  // Two layers of the same route can be mounted at once (a push lands before
  // the page it covers finishes leaving, and a swipe-back preview mounts a
  // second copy), so the sheet is reference counted: the first detach used to
  // switch it off under the page that was still on screen, leaving the route
  // rendered with no styles at all.
  let holders = 0;
  const apply = () => {
    if (holders === 0) {
      style.media = 'not all';
      return;
    }
    if (!routePath) {
      style.media = 'all';
      return;
    }
    const activeLayer = document.querySelector(
      `.route-tab-cache.is-active[data-route="${routePath}"]`,
    );
    style.media = activeLayer ? 'all' : 'not all';
  };
  if (routePath) registeredSheets.add({ apply, routePath });

  return {
    attach: () => {
      holders += 1;
      apply();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holders = Math.max(0, holders - 1);
        apply();
      };
    },
  };
}
