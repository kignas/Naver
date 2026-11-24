const LAYOUT_PROPERTIES = [
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  'rowGap',
  'columnGap',
  'fontSize',
  'lineHeight',
  'fontWeight',
  'fontFamily',
  'letterSpacing',
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'flexDirection',
  'flexWrap',
  'alignItems',
  'alignSelf',
  'justifyContent',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridAutoFlow',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'boxSizing',
  'whiteSpace',
  'textOverflow',
  'overflowX',
  'overflowY',
  'aspectRatio',
  'verticalAlign',
] as const;

const kebab = (property: string): string => property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

interface SnapshotEntry {
  element: Element;
  originalStyle: string | null;
  values: Array<[string, string]>;
  scrollTop: number;
  scrollLeft: number;
}

export interface LayoutSnapshot {
  entries: SnapshotEntry[];
}

// A hidden subtree reports scrollTop 0 even though the browser kept the real
// offset (a cached tab behind a pushed route). Freezing that 0 would destroy the
// offset when the layer is shown again, so hidden elements are not sampled.
const isMeasurable = (element: Element): boolean => {
  const style = window.getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none' && element.clientHeight + element.clientWidth > 0;
};

/** Captures the used layout of a subtree before an incoming route's global CSS can touch it. */
export function captureLayout(root: Element, maxNodes = Infinity): LayoutSnapshot {
  const entries: SnapshotEntry[] = [];
  const visit = (element: Element) => {
    if (entries.length >= maxNodes) return;
    const style = (element as HTMLElement | SVGElement).style;
    if (style) {
      const computed = window.getComputedStyle(element);
      const values: Array<[string, string]> = [];
      LAYOUT_PROPERTIES.forEach((property) => {
        const value = computed.getPropertyValue(kebab(property));
        if (value) values.push([kebab(property), value]);
      });
      const measurable = isMeasurable(element);
      entries.push({
        element,
        originalStyle: element.getAttribute('style'),
        values,
        scrollTop: measurable ? element.scrollTop : -1,
        scrollLeft: measurable ? element.scrollLeft : -1,
      });
    }
    Array.from(element.children).forEach(visit);
  };
  visit(root);
  return { entries };
}

/**
 * Re-reads the scroll offsets of an existing snapshot. Scroll offsets change on
 * every flick while the frozen styles do not, so this is all a navigation needs
 * (and it avoids re-running getComputedStyle on every tap).
 */
export function refreshSnapshotScroll(snapshot: LayoutSnapshot): void {
  snapshot.entries.forEach((entry) => {
    if (!entry.element.isConnected || entry.scrollTop < 0) return;
    const top = entry.element.scrollTop;
    // A zero read from a hidden subtree is not a real offset; keep the old one.
    if (top === 0 && entry.scrollTop > 0 && !isMeasurable(entry.element)) return;
    entry.scrollTop = top;
    entry.scrollLeft = entry.element.scrollLeft;
  });
}

/** Applies the snapshot with !important so the outgoing page cannot reflow. */
export function applyLayout(snapshot: LayoutSnapshot): () => void {
  snapshot.entries.forEach((entry) => {
    const declarations = entry.values.map(([property, value]) => `${property}:${value}!important`).join(';');
    const base = entry.originalStyle ? `${entry.originalStyle};` : '';
    entry.element.setAttribute('style', `${base}${declarations}`);
  });
  snapshot.entries.forEach((entry) => {
    if (entry.scrollTop >= 0) entry.element.scrollTop = entry.scrollTop;
    if (entry.scrollLeft >= 0) entry.element.scrollLeft = entry.scrollLeft;
  });

  return () => {
    snapshot.entries.forEach((entry) => {
      if (entry.originalStyle === null) entry.element.removeAttribute('style');
      else entry.element.setAttribute('style', entry.originalStyle);
    });
  };
}
