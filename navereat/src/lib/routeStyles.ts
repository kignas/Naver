export interface RouteStyleSheet {
  attach: () => () => void;
}

/**
 * Parses a large raw route stylesheet when its chunk loads (the idle
 * preloader), keeps it disabled, and only enables it for the route's lifetime.
 * The parse happens once; mount never parses or creates a stylesheet.
 */
export function createRouteStyleSheet(css: string, marker: string): RouteStyleSheet {
  const style = document.createElement('style');
  style.dataset[marker] = 'true';
  style.media = 'not all';
  style.textContent = css;
  document.head.appendChild(style);
  // Force the CSS parser to run now, while the route chunk is being preloaded.
  void style.sheet?.cssRules;

  return {
    attach: () => {
      style.media = 'all';
      return () => {
        style.media = 'not all';
      };
    },
  };
}
