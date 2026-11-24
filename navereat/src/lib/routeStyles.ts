import tabIsolationCss from '../styles/tab-isolation.css?raw';

export interface RouteStyleSheet {
  attach: () => () => void;
}

interface RegisteredSheet {
  style: HTMLStyleElement;
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
  for (const entry of registeredSheets) {
    const activeLayer = document.querySelector(
      `.route-tab-cache.is-active[data-route="${entry.routePath}"]`,
    );
    entry.style.media = activeLayer ? 'all' : 'not all';
  }
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
  if (routePath) registeredSheets.add({ style, routePath });

  return {
    attach: () => {
      style.media = 'all';
      if (routePath) syncRouteStyleSheets();
      return () => {
        style.media = 'not all';
      };
    },
  };
}
