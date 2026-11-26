import { useEffect, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchPlaceholder } from '../../hooks/useSearchPlaceholder';
import { useHashPath, useOverlayOpen } from '../../hooks/useOverlayOpen';

const ROLL_TRANSITION = { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 } as const;

const isSearchField = (node: EventTarget | null): boolean => {
  const element = node as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  return Boolean(element.closest('.search-box, .ew-search-sheet, input[type="search"], input[type="text"]'));
};

/**
 * "Search " stays static; only the quoted dish rolls, as in the original. AnimatePresence pops the
 * outgoing word up and brings the next one in from below. The cycle is paused
 * the moment Home is covered or the user focuses/types into a search field.
 */
export function SearchPlaceholderText({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const pathname = useHashPath();
  const overlayOpen = useOverlayOpen();
  const [focused, setFocused] = useState(false);
  const { dish } = useSearchPlaceholder(scrollerRef, pathname !== '/' || overlayOpen || focused);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isSearchField(event.target)) setFocused(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (isSearchField(event.target)) setFocused(false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <span className="search-text" id="search-placeholder" aria-label={`Search "${dish}"`}>
      <span className="search-static">Search&nbsp;</span>
      <span className="search-dish-slot">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={dish}
            className="search-dish"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={ROLL_TRANSITION}
          >
            &quot;{dish}&quot;
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
