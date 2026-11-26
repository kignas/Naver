import { lazy, memo, Suspense, useCallback, useMemo, type RefObject } from 'react';
import { restaurants, type MenuItem, type Restaurant } from '../../data/demo';
import { useHomeFeed } from '../../data';
import { clearCategory, retryCategory } from '../../lib/categoryMode';
import { useAppNav } from '../../lib/navigation';
import { useCustomize } from '../../lib/customizeContext';
import { useAppStore } from '../../store/appStore';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../Icon';
import { HomeRestaurantCard } from '../HomeRestaurantCard';

/**
 * The demo feed has 8 rows, where windowing costs more than it saves. Above the
 * threshold the real feed is windowed; below it the plain list is used so
 * `content-visibility` and the existing perf-gate selectors keep working.
 */
export const VIRTUALIZE_THRESHOLD = 30;

/** Keeps @tanstack/react-virtual out of the entry chunk; see the module. */
const VirtualizedRestaurantList = lazy(() => import('./VirtualizedRestaurantList'));

/**
 * Mount animation delay is a property of the restaurant, not of its position in
 * the filtered list: shifting it would re-render every card below a filtered-out
 * row and would re-stagger the feed whenever a filter changes.
 */
const STAGGER_INDEX_BY_ID = new Map(restaurants.map((restaurant, index) => [restaurant.id, index]));

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
  const activeCategory = useUiStore((state) => state.home.activeCategory);
  const categoryStatus = useUiStore((state) => state.home.categoryStatus);
  const categoryIds = useUiStore((state) => state.home.categoryIds);
  const categoryError = useUiStore((state) => state.home.categoryError);
  const resetHomeFilters = useUiStore((state) => state.resetHomeFilters);
  const cart = useAppStore((state) => state.cart);
  const addItem = useAppStore((state) => state.addItem);
  const decrementItem = useAppStore((state) => state.decrementItem);
  const selectRestaurant = useAppStore((state) => state.selectRestaurant);
  const nav = useAppNav();
  const { openCustomize } = useCustomize();
  const feedState = useHomeFeed();
  // Demo mode keeps the synchronous module data; api mode swaps in the live
  // feed once it lands and holds the card skeletons until then.
  const apiFeed = feedState.data?.restaurants;
  const feed = useMemo(
    () => (feedState.mode === 'api' ? (apiFeed ?? []) : restaurants),
    [apiFeed, feedState.mode],
  );
  const feedReady = ready && (feedState.mode !== 'api' || (!feedState.loading && !feedState.error));

  /* The category narrows the feed before the pills do: the original intersects
     `categoryMode.restaurantIds` with the active filters, so a category plus a
     pill can only ever be emptier than either alone. */
  const categorySet = useMemo(
    () => (activeCategory && categoryStatus === 'ready' ? new Set(categoryIds) : null),
    [activeCategory, categoryIds, categoryStatus],
  );

  const filteredRestaurants = useMemo(() => {
    const list = feed.filter((restaurant) => {
      if (categorySet && !categorySet.has(restaurant.id)) return false;
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
  }, [feed, categorySet, vegOnly, nearFast, rating4, under30, under100, sortBy]);

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
  const categoryLoading = categoryStatus === 'loading';
  const categoryFailed = categoryStatus === 'error';
  // `empty` is the dish search finding no restaurant at all; an empty filtered
  // list after a non-empty search is the filters' fault and says so.
  const categoryEmpty = categoryStatus === 'empty';

  const renderCard = useCallback(
    (restaurant: Restaurant, animate: boolean) => (
      <HomeRestaurantCard
        key={restaurant.id}
        restaurant={restaurant}
        staggerIndex={STAGGER_INDEX_BY_ID.get(restaurant.id) ?? 0}
        cart={cart}
        animate={animate}
        onOpen={openRestaurant}
        onAdd={addFromHome}
        onCustomize={handleCustomize}
        onIncrement={addItem}
        onDecrement={decrementItem}
      />
    ),
    [addFromHome, addItem, cart, decrementItem, handleCustomize, openRestaurant],
  );

  return (
    <section className="section" id="restaurants-section">
      <div className="sec-head">
        <h2 className="sec-title" id="restaurants-title">
          {activeCategory ? `${activeCategory} near you` : 'Restaurants near you'}
        </h2>
      </div>
      {!feedReady || categoryLoading ? (
        <div id="restaurant-list">
          <RestaurantSkeleton />
          <RestaurantSkeleton />
        </div>
      ) : (feedState.mode === 'api' && feedState.error) || categoryFailed ? (
        <div className="state-block" id="restaurant-list">
          <span className="state-icon" aria-hidden="true">
            <Icon name="solid:circle-exclamation" size={40} />
          </span>
          <p className="state-title">Couldn&apos;t load restaurants</p>
          <p className="state-sub">{(feedState.mode === 'api' && feedState.error) || categoryError}</p>
          <button
            type="button"
            className="state-btn"
            id="home-retry-btn"
            onClick={() => {
              clearCategory();
              feedState.reload();
            }}
          >
            Try Again
          </button>
        </div>
      ) : categoryEmpty ? (
        <div className="state-block" id="restaurant-list">
          <span className="state-icon" aria-hidden="true">
            <Icon name="solid:store" size={40} />
          </span>
          <p className="state-title">No restaurants available yet</p>
          <p className="state-sub">We&apos;re not delivering here right now. Please check back soon.</p>
          <button type="button" className="state-btn" id="home-retry-btn" onClick={() => void retryCategory()}>
            Refresh
          </button>
        </div>
      ) : filteredRestaurants.length ? (
        shouldVirtualize ? (
          <Suspense fallback={null}>
            <VirtualizedRestaurantList
              restaurants={filteredRestaurants}
              scrollerRef={scrollerRef}
              renderCard={renderCard}
            />
          </Suspense>
        ) : (
          <div id="restaurant-list">
            {filteredRestaurants.map((restaurant) => renderCard(restaurant, true))}
          </div>
        )
      ) : (
        <div className="state-block" id="restaurant-list">
          <span className="state-icon" aria-hidden="true">
            <Icon name="solid:filter-circle-xmark" size={40} />
          </span>
          <p className="state-title">No restaurants match your filters</p>
          <p className="state-sub">Try changing or clearing your filters.</p>
          <button type="button" className="state-btn" id="home-clear-filters" onClick={resetHomeFilters}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
});
