import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import heroDish from '../assets/placeholders/hero-dish.svg';
import { BottomNav } from '../components/BottomNav';
import { HomeRestaurantCard } from '../components/HomeRestaurantCard';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';
import { Sheet, type SheetHandle } from '../components/Sheet';
import {
  categories,
  DEMO_ADDRESS_LINE,
  DEMO_LOCATION,
  demoUser,
  restaurants,
  type MenuItem,
  type Restaurant,
} from '../data/demo';
import { useCachedReady } from '../hooks/useCachedReady';
import { useSearchPlaceholder } from '../hooks/useSearchPlaceholder';
import { useAppNav } from '../lib/navigation';
import { useCustomize } from '../lib/customizeContext';
import { useAppStore } from '../store/appStore';
import { useSearchStore } from '../store/searchStore';
import { useUiStore } from '../store/uiStore';
import { toast } from '../store/toastStore';
import '../styles/original/header-theme.css';
import '../styles/original/home-base.css';
import '../styles/original/home.bundle.css';
import '../styles/original/home-final.css';
import '../styles/pages/home.css';

type FilterTab = 'SORT' | 'DELIVERY TIME' | 'RATING' | 'PRICE' | 'OFFERS' | 'FOOD TYPE';
type SortKey = 'recommended' | 'rating' | 'delivery' | 'distance';

const FILTER_TABS: Array<{ id: FilterTab; label: string; icon: IconName }> = [
  { id: 'SORT', label: 'Sort By', icon: 'solid:sliders' },
  { id: 'RATING', label: 'Rating', icon: 'solid:star' },
  { id: 'PRICE', label: 'Price', icon: 'solid:indian-rupee-sign' },
  { id: 'DELIVERY TIME', label: 'Time', icon: 'regular:clock' },
  { id: 'OFFERS', label: 'Offers', icon: 'solid:tag' },
  { id: 'FOOD TYPE', label: 'Food Type', icon: 'solid:leaf' },
];

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

export function Home() {
  const nav = useAppNav();
  const ready = useCachedReady('home', 420, 650);
  const patchHome = useUiStore((state) => state.patchHome);
  const cachedHome = useUiStore.getState().home;
  const cart = useAppStore((state) => state.cart);
  const user = useAppStore((state) => state.user);
  const addItem = useAppStore((state) => state.addItem);
  const decrementItem = useAppStore((state) => state.decrementItem);
  const selectRestaurant = useAppStore((state) => state.selectRestaurant);
  const [vegOnly, setVegOnly] = useState(cachedHome.vegOnly);
  const [nearFast, setNearFast] = useState(cachedHome.nearFast);
  const [rating4, setRating4] = useState(cachedHome.rating4);
  const [under30, setUnder30] = useState(cachedHome.under30);
  const [under100, setUnder100] = useState(cachedHome.under100);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const filterSheetRef = useRef<SheetHandle>(null);
  const closeFilterSheet = () => filterSheetRef.current?.close();
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>(() => {
    const tab = cachedHome.activeFilterTab;
    return FILTER_TABS.some((entry) => entry.id === tab) ? (tab as FilterTab) : 'SORT';
  });
  const [sortBy, setSortBy] = useState<SortKey>(cachedHome.sortBy);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openSearch = useSearchStore((state) => state.openSearch);
  const { dish: searchDish, duration: searchDishDuration } = useSearchPlaceholder(scrollRef);

  const initial = (user?.name ?? demoUser.name).charAt(0).toUpperCase();

  useEffect(() => {
    patchHome({ vegOnly, nearFast, rating4, under30, under100, sortBy, activeFilterTab });
  }, [activeFilterTab, nearFast, patchHome, rating4, sortBy, under100, under30, vegOnly]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !ready) return;
    scroller.scrollTop = cachedHome.scrollTop;
  }, [cachedHome.scrollTop, ready]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Light });
    void StatusBar.setBackgroundColor({ color: '#5D0D18' });
    return () => {
      void StatusBar.setStyle({ style: Style.Dark });
      void StatusBar.setBackgroundColor({ color: '#ffffff' });
    };
  }, []);

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

  const openRestaurant = (restaurant: Restaurant) => {
    selectRestaurant(restaurant.id);
    nav.push(`/restaurant/${restaurant.id}`);
  };

  const { openCustomize } = useCustomize();

  const addFromHome = (restaurant: Restaurant, menuItem: MenuItem) => {
    selectRestaurant(restaurant.id);
    nav.push(`/restaurant/${restaurant.id}`);
    toast(`${menuItem.name} — add it from the menu`);
  };

  const openCategory = (name: string, query: string) => {
    nav.push(`/category/${encodeURIComponent(name)}?q=${encodeURIComponent(query)}`);
  };

  const clearFilters = () => {
    setSortBy('recommended');
    setNearFast(false);
    setRating4(false);
    setUnder30(false);
    setUnder100(false);
    setVegOnly(false);
  };

  return (
    <div className="home-screen">
      <div
        className="home-scroll"
        ref={scrollRef}
        onScroll={() => {
          const scroller = scrollRef.current;
          if (scroller) patchHome({ scrollTop: scroller.scrollTop });
        }}
      >
        <header className="hero-header" id="home-header">
          <div className="loc-row es-header-item">
            <button
              type="button"
              className="loc-left tap"
              aria-label="Delivery location"
              onClick={() => toast(DEMO_LOCATION)}
            >
              <span className="loc-pin-wrap" aria-hidden="true">
                <Icon name="solid:location-dot" size={27} className="loc-pin-icon" />
              </span>
              <span className="loc-copy">
                <span className="loc-name-row">
                  <span className="loc-name" id="loc-name">
                    Home
                  </span>
                  <Icon name="solid:chevron-down" size={9} className="loc-chevron" />
                </span>
                <span className="loc-sub" id="loc-sub">
                  {DEMO_ADDRESS_LINE}
                </span>
              </span>
            </button>
            <div className="loc-right">
              <button
                type="button"
                className="btn-store tap"
                aria-label="Under 99 store"
                onClick={() => nav.push('/under99')}
              >
                <span className="store-top">UNDER</span>
                <span className="store-bot">₹99</span>
              </button>
              <button
                type="button"
                className="btn-profile tap"
                aria-label="Profile"
                onClick={() => nav.tab('/profile')}
              >
                <span className="profile-initial">{initial}</span>
              </button>
            </div>
          </div>

          <div className="search-row es-header-item">
            <button
              type="button"
              className="search-box tap"
              onClick={() => openSearch('home')}
              aria-haspopup="dialog"
            >
              <Icon name="solid:magnifying-glass" size={18} className="search-icon" />
              <span className="search-text" id="search-placeholder" aria-label={`Search "${searchDish}"`}>
                <span className="search-static">Search&nbsp;</span>
                <span
                  className="search-dish is-sliding"
                  key={searchDish}
                  style={{ '--search-dish-duration': `${searchDishDuration}ms` } as CSSProperties}
                >
                  &quot;{searchDish}&quot;
                </span>
              </span>
              <span
                className="search-mic"
                role="button"
                tabIndex={0}
                aria-label="Voice search"
                onClick={(event) => {
                  event.stopPropagation();
                  toast('Voice search is demo only');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    toast('Voice search is demo only');
                  }
                }}
              >
                <Icon name="solid:microphone" size={17} />
              </span>
            </button>
            <button
              type="button"
              className="veg-box tap"
              id="veg-toggle-btn"
              aria-pressed={vegOnly}
              aria-label="Show pure veg restaurants only"
              onClick={() => setVegOnly((value) => !value)}
            >
              <span className="veg-label-txt">VEG</span>
              <span className={`veg-track${vegOnly ? ' on' : ''}`} id="veg-track">
                <span className="veg-thumb">
                  <span className="veg-inner">
                    <span className="veg-inner-dot" />
                  </span>
                </span>
              </span>
            </button>
          </div>

          <div className="banner-wrap es-header-item" id="hero-banner-region" aria-live="polite">
            <div className="header-carousel" id="banner-carousel" aria-roledescription="carousel" aria-label="Promotions">
              <div className="header-carousel-track" id="header-carousel-track">
                <article className="header-slide is-active" role="group" aria-roledescription="slide" aria-label="Banner 1">
                  <div className="header-slide__panel">
                    <div className="header-slide__copy">
                      <h2 className="banner-title">
                        Good Food
                        <br />
                        <span className="banner-title-accent">Closer to Home.</span>
                      </h2>
                      <p className="banner-subtitle banner-subtitle--default">
                        Tasty food
                        <br />
                        Happier you. <span className="banner-heart" aria-hidden="true">♥</span>
                      </p>
                      <button type="button" className="banner-cta" onClick={() => nav.push('/under99')}>
                        Order Now
                        <span className="banner-cta__chev" aria-hidden="true">
                          <Icon name="solid:chevron-right" size={11} />
                        </span>
                      </button>
                    </div>
                    <img className="header-slide__art" src={heroDish} alt="" aria-hidden="true" />
                  </div>
                </article>
              </div>
            </div>
          </div>
          <div className="ew-strip" aria-hidden="true">
            Nearby restaurants &middot; Demo City
          </div>
        </header>

        <main className="home-main">
          <section className="section" id="mind-section">
            <div className="sec-head">
              <h2 className="sec-title">What&apos;s on your mind?</h2>
            </div>
            <div className="cat-scroll no-scrollbar" id="cat-scroll">
              {categories.map((category, index) => (
                <a
                  className="cat-item"
                  href={`#${encodeURIComponent(category.name)}`}
                  data-category-name={category.name}
                  key={category.id}
                  style={{
                    animation: `cardFadeUp .28s ease forwards ${Math.min(index, 8) * 0.03}s`,
                    opacity: 0,
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    openCategory(category.name, category.query);
                  }}
                >
                  <span className="cat-ring cat-image-shell">
                    <span className="cat-image-placeholder" aria-hidden="true">
                      <span className="cat-placeholder-mark">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 9.5h10M8.5 13h7M9.5 16.5h5M5.5 6.5h13a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V8a1.5 1.5 0 0 1 1.5-1.5Z" />
                        </svg>
                      </span>
                    </span>
                    <img src={category.image} alt={`${category.name} food delivery in Demo City`} loading="lazy" decoding="async" className="loaded" />
                    <span className="cat-selected-badge" aria-hidden="true">
                      <Icon name="solid:check" size={10} />
                    </span>
                  </span>
                  <span className="cat-name">{category.name}</span>
                </a>
              ))}
            </div>
          </section>

          <div className="filter-bar" id="filter-bar" role="group" aria-label="Restaurant filters">
            <button
              type="button"
              className={`filter-pill filter-pill-sheet${filterSheetOpen ? ' active' : ''}`}
              onClick={() => setFilterSheetOpen(true)}
            >
              <Icon name="solid:sliders" size={11} /> Filters
            </button>
            <button
              type="button"
              className={`filter-pill${nearFast ? ' active' : ''}`}
              aria-pressed={nearFast}
              onClick={() => setNearFast((value) => !value)}
            >
              <Icon name="solid:bolt-lightning" size={11} style={{ color: 'var(--ew-success,#23956D)' }} /> Near &amp; Fast
            </button>
            <button
              type="button"
              className={`filter-pill${rating4 ? ' active' : ''}`}
              aria-pressed={rating4}
              onClick={() => setRating4((value) => !value)}
            >
              Rating 4.0+
            </button>
            <button
              type="button"
              className={`filter-pill${under100 ? ' active' : ''}`}
              aria-pressed={under100}
              onClick={() => setUnder100((value) => !value)}
            >
              Items under ₹100
            </button>
            <button
              type="button"
              className={`filter-pill${under30 ? ' active' : ''}`}
              aria-pressed={under30}
              onClick={() => setUnder30((value) => !value)}
            >
              Under 30 min
            </button>
          </div>

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
              <div id="restaurant-list">
                {filteredRestaurants.map((restaurant, index) => (
                  <HomeRestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={index}
                    cart={cart}
                    onOpen={() => openRestaurant(restaurant)}
                    onAdd={(menuItem) => addFromHome(restaurant, menuItem)}
                    onCustomize={(menuItem) => openCustomize(menuItem, restaurant.id, { editExisting: true })}
                    onIncrement={(menuItem) => addItem(menuItem, restaurant.id)}
                    onDecrement={(menuItem) => decrementItem(menuItem.name)}
                  />
                ))}
              </div>
            ) : (
              <div className="home-empty">
                No restaurants match these filters. Try clearing a filter.
              </div>
            )}
          </section>

          <div className="ew-feed-end" id="home-feed-end" aria-label="End of restaurant list">
            <h2 className="ew-feed-end__title">That&apos;s all we&apos;ve got!</h2>
            <p className="ew-feed-end__sub">
              A curated list of top-rated restaurants <span className="ew-feed-end__heart" aria-hidden="true" />
            </p>
            <p className="ew-feed-end__made">
              Navereat <span className="ew-feed-end__sun" aria-hidden="true" />
            </p>
          </div>
        </main>
      </div>

      <BottomNav />

      {filterSheetOpen && (
        <Sheet
          ref={filterSheetRef}
          variant="filter"
          title="Filters & sorting"
          onClose={() => setFilterSheetOpen(false)}
          ariaLabel="Filters and sorting"
          headerAction={
            <button type="button" className="sheet-clear" onClick={clearFilters}>
              Clear all
            </button>
          }
          tabs={FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`filter-tab${activeFilterTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveFilterTab(tab.id)}
            >
              <i className="filter-tab-icon" aria-hidden="true">
                <Icon name={tab.icon} size={18} />
              </i>
              <span>{tab.label}</span>
            </button>
          ))}
          footer={
            <>
              <button type="button" className="sheet-close-btn" onClick={closeFilterSheet}>
                Close
              </button>
              <button type="button" className="sheet-done" onClick={closeFilterSheet}>
                Show results
              </button>
            </>
          }
        >
          {activeFilterTab === 'SORT' ? (
            <section className="filter-section">
              <h4 className="filter-section-title">Sort by</h4>
              <div className="sort-list">
                {[
                  { id: 'recommended' as const, label: 'Relevance' },
                  { id: 'rating' as const, label: 'Rating: High to Low' },
                  { id: 'delivery' as const, label: 'Delivery Time: Fast to Slow' },
                  { id: 'distance' as const, label: 'Distance: Near to Far' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`sort-option${sortBy === option.id ? ' selected' : ''}`}
                    onClick={() => setSortBy(option.id)}
                  >
                    <span>{option.label}</span>
                    <i className="check-icon" aria-hidden="true">
                      <Icon name="solid:check" size={12} />
                    </i>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="filter-section">
              <h4 className="filter-section-title">
                {activeFilterTab === 'DELIVERY TIME'
                  ? 'Time'
                  : activeFilterTab === 'FOOD TYPE'
                    ? 'Food type'
                    : activeFilterTab.charAt(0) + activeFilterTab.slice(1).toLowerCase()}
              </h4>
              <div className="filter-grid">
                {activeFilterTab === 'DELIVERY TIME' && (
                  <>
                    <button type="button" className={`sheet-option${nearFast ? ' selected' : ''}`} onClick={() => setNearFast((value) => !value)}>
                      <i className="option-icon" aria-hidden="true"><Icon name="solid:bolt-lightning" size={17} /></i>
                      <span>Near &amp; Fast</span>
                      <i className="check-icon" aria-hidden="true"><Icon name="solid:check" size={11} /></i>
                    </button>
                    <button type="button" className={`sheet-option${under30 ? ' selected' : ''}`} onClick={() => setUnder30((value) => !value)}>
                      <i className="option-icon" aria-hidden="true"><Icon name="regular:clock" size={17} /></i>
                      <span>Under 30 min</span>
                      <i className="check-icon" aria-hidden="true"><Icon name="solid:check" size={11} /></i>
                    </button>
                  </>
                )}
                {activeFilterTab === 'RATING' && (
                  <button type="button" className={`sheet-option${rating4 ? ' selected' : ''}`} onClick={() => setRating4((value) => !value)}>
                    <i className="option-icon" aria-hidden="true"><Icon name="solid:star" size={17} /></i>
                    <span>Rating 4.0+</span>
                    <i className="check-icon" aria-hidden="true"><Icon name="solid:check" size={11} /></i>
                  </button>
                )}
                {activeFilterTab === 'PRICE' && (
                  <button type="button" className={`sheet-option${under100 ? ' selected' : ''}`} onClick={() => setUnder100((value) => !value)}>
                    <i className="option-icon" aria-hidden="true"><Icon name="solid:indian-rupee-sign" size={17} /></i>
                    <span>Items under ₹100</span>
                    <i className="check-icon" aria-hidden="true"><Icon name="solid:check" size={11} /></i>
                  </button>
                )}
                {activeFilterTab === 'OFFERS' && (
                  <button type="button" className="sheet-option">
                    <i className="option-icon" aria-hidden="true"><Icon name="solid:tag" size={17} /></i>
                    <span>Offers</span>
                    <i className="check-icon" aria-hidden="true"><Icon name="solid:check" size={11} /></i>
                  </button>
                )}
                {activeFilterTab === 'FOOD TYPE' && (
                  <button type="button" className={`sheet-option${vegOnly ? ' selected' : ''}`} onClick={() => setVegOnly((value) => !value)}>
                    <i className="option-icon" aria-hidden="true"><Icon name="solid:leaf" size={17} /></i>
                    <span>Pure Veg</span>
                    <i className="check-icon" aria-hidden="true"><Icon name="solid:check" size={11} /></i>
                  </button>
                )}
              </div>
            </section>
          )}
        </Sheet>
      )}
    </div>
  );
}
