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

/** Captures the used layout of a subtree before an incoming route's global CSS can touch it. */
export function captureLayout(root: Element): LayoutSnapshot {
  const entries: SnapshotEntry[] = [];
  const visit = (element: Element) => {
    const style = (element as HTMLElement | SVGElement).style;
    if (style) {
      const computed = window.getComputedStyle(element);
      const values: Array<[string, string]> = [];
      LAYOUT_PROPERTIES.forEach((property) => {
        const value = computed.getPropertyValue(kebab(property));
        if (value) values.push([kebab(property), value]);
      });
      entries.push({
        element,
        originalStyle: element.getAttribute('style'),
        values,
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
      });
    }
    Array.from(element.children).forEach(visit);
  };
  visit(root);
  return { entries };
}

/** Applies the snapshot with !important so the outgoing page cannot reflow. */
export function applyLayout(snapshot: LayoutSnapshot): () => void {
  snapshot.entries.forEach((entry) => {
    const style = (entry.element as HTMLElement | SVGElement).style;
    entry.values.forEach(([property, value]) => {
      style.setProperty(property, value, 'important');
    });
  });
  snapshot.entries.forEach((entry) => {
    entry.element.scrollTop = entry.scrollTop;
    entry.element.scrollLeft = entry.scrollLeft;
  });

  return () => {
    snapshot.entries.forEach((entry) => {
      if (entry.originalStyle === null) entry.element.removeAttribute('style');
      else entry.element.setAttribute('style', entry.originalStyle);
    });
  };
}
