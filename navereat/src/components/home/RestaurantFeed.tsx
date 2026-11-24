import { memo, useCallback, useLayoutEffect, useMemo, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { restaurants, type MenuItem, type Restaurant } from '../../data/demo';
import { useAppNav } from '../../lib/navigation';
import { useCustomize } from '../../lib/customizeContext';
import { useAppStore } from '../../store/appStore';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { HomeRestaurantCard } from '../HomeRestaurantCard';

/**
 * The demo feed has 8 rows, where windowing costs more than it saves. Above the
 * threshold the real feed is windowed; below it the plain list is used so
 * `content-visibility` and the existing perf-gate selectors keep working.
 */
export const VIRTUALIZE_THRESHOLD = 30;

const ESTIMATED_CARD_HEIGHT = 420;

function RestaurantSkeleton() {
  return (
    <div className="u99-card-host rs-skeleton" aria-hidden="true">
      <article className="u99-restaurant-card">
        <div className="u99-restaurant-head">
          <div className="u99-card-copy">
            <div className="u99-discount-line">
              <span className="sk rsk-line" style={{ width: '38%' }} />
            </div>
            <h2 className="u99-restaurant-name">
              <span className="sk rsk-line" style={{ width: '64%' }} />
            </h2>
            <div className="u99-meta">
              <span className="sk rsk-line" style={{ width: 52 }} />
              <span className="sk rsk-line" style={{ width: 70 }} />
              <span className="sk rsk-line" style={{ width: 88 }} />
            </div>
            <div className="u99-free-row">
              <span className="sk rsk-line" style={{ width: '56%' }} />
            </div>
          </div>
        </div>
        <div className="u99-carousel-wrap">
          <div className="u99-carousel">
            {[0, 1].map((index) => (
              <article className="u99-item" key={index}>
                <div className="u99-item-image">
                  <span className="sk rsk-fill" />
                  <span className="sk rsk-add" />
                </div>
                <div className="u99-item-name">
                  <span className="sk rsk-line" style={{ width: '82%' }} />
                </div>
                <div className="u99-price-row">
                  <span className="sk rsk-line" style={{ width: '44%' }} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

interface RestaurantFeedProps {
  ready: boolean;
  scrollerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Owns the filter subscriptions, the filtered list and the cart subscription,
 * so neither a filter tap nor a cart mutation reaches the Home component.
 */
export const RestaurantFeed = memo(function RestaurantFeed({ ready, scrollerRef }: RestaurantFeedProps) {
  const vegOnly = useUiStore((state) => state.home.vegOnly);
  const nearFast = useUiStore((state) => state.home.nearFast);
  const rating4 = useUiStore((state) => state.home.rating4);
  const under30 = useUiStore((state) => state.home.under30);
  const under100 = useUiStore((state) => state.home.under100);
  const sortBy = useUiStore((state) => state.home.sortBy);
  const cart = useAppStore((state) => state.cart);
  const addItem = useAppStore((state) => state.addItem);
  const decrementItem = useAppStore((state) => state.decrementItem);
  const selectRestaurant = useAppStore((state) => state.selectRestaurant);
  const nav = useAppNav();
  const { openCustomize } = useCustomize();

  const filteredRestaurants = useMemo(() => {
    const list = restaurants.filter((restaurant) => {
      if (vegOnly && !(restaurant.pureVeg ?? restaurant.menu.every((item) => item.isVeg))) return false;
      if (nearFast && (restaurant.deliveryMax ?? 999) > 30) return false;
      if (rating4 && Number(restaurant.rating) < 4) return false;
      if (under100 && !restaurant.menu.some((item) => item.price < 100)) return false;
      if (under30 && (restaurant.deliveryMax ?? 999) > 30) return false;
      return true;
    });
    if (sortBy === 'rating') list.sort((a, b) => Number(b.rating) - Number(a.rating));
    if (sortBy === 'delivery') list.sort((a, b) => (a.deliveryMax ?? 999) - (b.deliveryMax ?? 999));
    if (sortBy === 'distance') list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    return list;
  }, [vegOnly, nearFast, rating4, under30, under100, sortBy]);

  const openRestaurant = useCallback(
    (restaurant: Restaurant) => {
      selectRestaurant(restaurant.id);
      nav.push(`/restaurant/${restaurant.id}`);
    },
    [nav, selectRestaurant],
  );

  const addFromHome = useCallback(
    (restaurant: Restaurant, menuItem: MenuItem) => {
      selectRestaurant(restaurant.id);
      nav.push(`/restaurant/${restaurant.id}`);
      toast(`${menuItem.name} — add it from the menu`);
    },
    [nav, selectRestaurant],
  );

  const handleCustomize = useCallback(
    (restaurant: Restaurant, menuItem: MenuItem) => {
      openCustomize(menuItem, restaurant.id, { editExisting: true });
    },
    [openCustomize],
  );

  const shouldVirtualize = filteredRestaurants.length > VIRTUALIZE_THRESHOLD;
  const getItemKey = useCallback((index: number) => filteredRestaurants[index].id, [filteredRestaurants]);

  const rowVirtualizer = useVirtualizer({
    count: filteredRestaurants.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 4,
    getItemKey,
    enabled: shouldVirtualize,
  });

  useLayoutEffect(() => {
    if (!shouldVirtualize || !ready) return;
    const saved = useUiStore.getState().home.scrollTop;
    if (saved > 0) rowVirtualizer.scrollToOffset(saved);
  }, [ready, rowVirtualizer, shouldVirtualize]);

  const renderCard = (restaurant: Restaurant, index: number, animate: boolean) => (
    <HomeRestaurantCard
      key={restaurant.id}
      restaurant={restaurant}
      index={index}
      cart={cart}
      animate={animate}
      onOpen={openRestaurant}
      onAdd={addFromHome}
      onCustomize={handleCustomize}
      onIncrement={addItem}
      onDecrement={decrementItem}
    />
  );

  return (
    <section className="section" id="restaurants-section">
      <div className="sec-head">
        <h2 className="sec-title" id="restaurants-title">
          Restaurants near you
        </h2>
      </div>
      {!ready ? (
        <div id="restaurant-list">
          <RestaurantSkeleton />
          <RestaurantSkeleton />
        </div>
      ) : filteredRestaurants.length ? (
        shouldVirtualize ? (
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
                {renderCard(filteredRestaurants[virtualRow.index], virtualRow.index, false)}
              </div>
            ))}
          </div>
        ) : (
          <div id="restaurant-list">
            {filteredRestaurants.map((restaurant, index) => renderCard(restaurant, index, true))}
          </div>
        )
      ) : (
        <div className="home-empty">No restaurants match these filters. Try clearing a filter.</div>
      )}
    </section>
  );
});
