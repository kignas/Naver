export interface RouteStyleSheet {
  attach: () => () => void;
}

const supportsAdopted =
  typeof CSSStyleSheet !== 'undefined' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  'adoptedStyleSheets' in Document.prototype;

/**
 * Parses a large raw route stylesheet when its chunk loads, not when the route
 * mounts. The sheet is only activated for the lifetime of the route.
 */
export function createRouteStyleSheet(css: string, marker: string): RouteStyleSheet {
  if (supportsAdopted) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return {
      attach: () => {
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        return () => {
          document.adoptedStyleSheets = document.adoptedStyleSheets.filter((entry) => entry !== sheet);
        };
      },
    };
  }

  return {
    attach: () => {
      const style = document.createElement('style');
      style.dataset[marker] = 'true';
      style.textContent = css;
      document.head.appendChild(style);
      return () => style.remove();
    },
  };
}
