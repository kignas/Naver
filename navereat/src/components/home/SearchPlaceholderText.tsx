import type { CSSProperties, RefObject } from 'react';
import { useSearchPlaceholder } from '../../hooks/useSearchPlaceholder';
import { useHashPath, useOverlayOpen } from '../../hooks/useOverlayOpen';

/**
 * The rotating search placeholder lives in its own component: its timer used to
 * re-render the whole Home page every ~2 s, including while Home was covered by
 * a pushed route or another tab. Now a tick re-renders this span only, and the
 * rotation is paused whenever Home is not the visible top route or a sheet or
 * the search overlay is open.
 */
export function SearchPlaceholderText({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const pathname = useHashPath();
  const overlayOpen = useOverlayOpen();
  const { dish, duration } = useSearchPlaceholder(scrollerRef, pathname !== '/' || overlayOpen);
  return (
    <span className="search-text" id="search-placeholder" aria-label={`Search "${dish}"`}>
      <span className="search-static">Search&nbsp;</span>
      <span
        className="search-dish is-sliding"
        key={dish}
        style={{ '--search-dish-duration': `${duration}ms` } as CSSProperties}
      >
        &quot;{dish}&quot;
      </span>
    </span>
  );
}
