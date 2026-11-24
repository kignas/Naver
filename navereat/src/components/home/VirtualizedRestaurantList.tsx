import { useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Restaurant } from '../../data/demo';
import { useUiStore } from '../../store/uiStore';

const ESTIMATED_CARD_HEIGHT = 420;

interface VirtualizedRestaurantListProps {
  restaurants: Restaurant[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  renderCard: (restaurant: Restaurant, animate: boolean) => ReactNode;
}

/**
 * The only module that pulls in @tanstack/react-virtual. It is reached through
 * `lazy()` in RestaurantFeed, so the windowing runtime stays out of the entry
 * chunk for the eight-row demo feed, which never takes this branch.
 */
export default function VirtualizedRestaurantList({
  restaurants,
  scrollerRef,
  renderCard,
}: VirtualizedRestaurantListProps) {
  const rowVirtualizer = useVirtualizer({
    count: restaurants.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 4,
    getItemKey: (index) => restaurants[index].id,
  });

  useLayoutEffect(() => {
    const saved = useUiStore.getState().home.scrollTop;
    if (saved > 0) rowVirtualizer.scrollToOffset(saved);
  }, [rowVirtualizer]);

  return (
    <div id="restaurant-list" style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.key}
          data-index={virtualRow.index}
          ref={rowVirtualizer.measureElement}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          {renderCard(restaurants[virtualRow.index], false)}
        </div>
      ))}
    </div>
  );
}
