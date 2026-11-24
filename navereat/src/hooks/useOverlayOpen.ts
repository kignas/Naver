import { useEffect, useState } from 'react';
import { subscribeSheetCount, sheetCount } from '../lib/sheetStack';

const OVERLAY_CLASSES = [
  'nb-sheet-open',
  'ewcs-custom-open',
  'u99-cust-open',
  'filter-sheet-open',
  'ct-sheet-open',
  'u99-modal-open',
];

const bodyHasOverlay = (): boolean => OVERLAY_CLASSES.some((name) => document.body.classList.contains(name));

/**
 * True while a sheet, the search overlay or another modal owns the screen.
 * Legacy sheets only announce themselves through body classes, so the body
 * class list is observed rather than polled.
 */
export function useOverlayOpen(): boolean {
  const [sheetOpen, setSheetOpen] = useState(() => sheetCount() > 0);
  const [bodyOpen, setBodyOpen] = useState(bodyHasOverlay);

  useEffect(() => {
    const unsubscribe = subscribeSheetCount(() => setSheetOpen(sheetCount() > 0));
    const observer = new MutationObserver(() => setBodyOpen(bodyHasOverlay()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  return sheetOpen || bodyOpen;
}
