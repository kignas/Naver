import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MenuCatNav } from '../components/menu/MenuCatNav';
import { MenuFilterBar } from '../components/menu/MenuFilterBar';
import { MenuFiltersProvider } from '../components/menu/MenuFiltersProvider';
import { MenuFreeDeliveryStrip } from '../components/menu/MenuFreeDeliveryStrip';
import { MenuSection } from '../components/menu/MenuSection';
import { MenuSkeleton } from '../components/menu/MenuSkeleton';
import { MenuJump } from '../components/restaurant/MenuJump';
import { RestaurantSearchPage } from '../components/restaurant/RestaurantSearchPage';
import { StickySearchBar } from '../components/restaurant/StickySearchBar';
import type { MenuGroup } from '../components/menu/menuTypes';
import { SlideReveal } from '../components/reveal/SlideReveal';
import { findRestaurant } from '../data/demo';
import { useRestaurantData } from '../data';
import type { MenuItem } from '../data/demo';
import { useCachedReady } from '../hooks/useCachedReady';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { useNavStore } from '../store/navStore';
import { useUiStore } from '../store/uiStore';
import { toast } from '../store/toastStore';
import restaurantBundleCss from '../styles/original/restaurant.bundle.css?raw';
import restaurantShellCss from '../styles/original/restaurant-shell.css?raw';
import restaurantSearchCss from '../styles/original/restaurant-search-page.css?raw';
import menuJumpCss from '../styles/original/menu-jump.css?raw';
import '../styles/pages/restaurant.css';

const restaurantStyle = createRouteStyleSheet(
  `${restaurantBundleCss}\n${restaurantShellCss}\n${restaurantSearchCss}\n${menuJumpCss}`,
  'navereatRestaurant',
);

/** Restaurant layers can overlap during a slide; the body class follows all of them. */
let restaurantBodies = 0;

type MenuTab = 'menu' | 'info';

function compactCount(value: number | undefined): string {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count < 1000) return String(Math.round(count));
  if (count < 1000000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : Number(k.toFixed(1))}K`;
  }
  const m = count / 1000000;
  return `${m >= 10 ? Math.round(m) : Number(m.toFixed(1))}M`;
}

function itemCount(value: number | undefined): string {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count < 1000) return String(Math.round(count));
  if (count < 1000000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : Number(k.toFixed(1))}k`;
  }
  return `${Number((count / 1000000).toFixed(1))}M`;
}

export function Restaurant() {
  const perfWindow = window as Window & { __menuRenders?: number };
  perfWindow.__menuRenders = (perfWindow.__menuRenders ?? 0) + 1;
  const { id } = useParams<{ id: string }>();
  const routeId = Number(id);
  const apiRestaurant = useRestaurantData(id ?? '');
  // Demo mode resolves synchronously from the bundled data; api mode swaps in
  // the fetched restaurant (with its menu) once it lands.
  const resolvedRestaurant =
    apiRestaurant.mode === 'api'
      ? apiRestaurant.restaurant
        ? { ...apiRestaurant.restaurant, menu: apiRestaurant.menu }
        : undefined
      : findRestaurant(id);
  // A route that is leaving is still on screen while the next one slides in, but
  // useParams() already reports the new route, so findRestaurant() returns
  // undefined and the page would swap itself for "Restaurant not found" mid
  // slide (a full-page jump at the bottom of the screen). Keep the last real
  // restaurant for the lifetime of the layer.
  const lastRestaurantRef = useRef(resolvedRestaurant);
  if (resolvedRestaurant) lastRestaurantRef.current = resolvedRestaurant;
  const restaurant = resolvedRestaurant ?? lastRestaurantRef.current;
  // Same reason as above: while the page is leaving, useParams() reports the new
  // route (no id), so every store read keyed by routeId would miss and the page
  // would re-render in its empty state mid slide. Keep the last real id.
  const lastRouteIdRef = useRef(routeId);
  if (Number.isFinite(routeId)) lastRouteIdRef.current = routeId;
  const stableRouteId = Number.isFinite(routeId) ? routeId : lastRouteIdRef.current;
  const nav = useAppNav();
  const ready = useCachedReady(`restaurant:${stableRouteId}`, 200, 340);
  const cachedRestaurant = useUiStore.getState().restaurants[stableRouteId];
  const cachedMenu = useUiStore((s) => s.menus[stableRouteId]);
  const patchRestaurant = useUiStore((s) => s.patchRestaurant);
  const selectRestaurant = useAppStore((s) => s.selectRestaurant);
  const preparing = useNavStore((s) => s.preparing);

  const [tab, setTab] = useState<MenuTab>(cachedRestaurant?.tab ?? 'menu');
  const [menuSearchOpen, setMenuSearchOpen] = useState(cachedRestaurant?.menuSearchOpen ?? false);
  const [saved, setSaved] = useState(cachedRestaurant?.saved ?? false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef(performance.now());

  useLayoutEffect(() => {
    const detach = restaurantStyle.attach();
    // Same overlap as the stylesheet: a leaving restaurant layer must not clear
    // the viewport rules the incoming one is already using.
    restaurantBodies += 1;
    document.body.classList.add('navereat-restaurant');
    document.documentElement.dataset.ewHeader = 'raspberry';
    document.documentElement.dataset.ewTheme = 'light';
    return () => {
      detach();
      restaurantBodies = Math.max(0, restaurantBodies - 1);
      if (restaurantBodies === 0) document.body.classList.remove('navereat-restaurant');
    };
  }, []);

  useEffect(() => {
    if (!restaurant || preparing) return;
    selectRestaurant(restaurant.id);
    document.title = `${restaurant.name} – Navereat`;
    return () => {
      document.title = 'Navereat';
    };
  }, [preparing, restaurant, selectRestaurant]);

  useEffect(() => {
    if (!Number.isFinite(routeId) || preparing) return;
    patchRestaurant(routeId, { tab, menuSearchOpen, saved });
  }, [menuSearchOpen, patchRestaurant, preparing, routeId, saved, tab]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !ready) return;
    scroller.scrollTop = cachedRestaurant?.scrollTop ?? 0;
  }, [cachedRestaurant?.scrollTop, ready, routeId]);

  // Scroll position only: the category spy lives in MenuCatNav, next to the
  // pills it drives.
  const handleMenuScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || !Number.isFinite(routeId)) return;
    patchRestaurant(routeId, { scrollTop: scroller.scrollTop });
  }, [patchRestaurant, routeId]);

  const location = useLocation();
  const focusItem = useMemo(() => new URLSearchParams(location.search).get('focusItem'), [location.search]);

  const closeSearch = useCallback(() => setMenuSearchOpen(false), []);

  const jumpToCategory = useCallback((targetId: string) => {
    setTab('menu');
    const run = () => {
      const scroller = scrollRef.current;
      const target = document.getElementById(targetId);
      if (!scroller || !target) return;
      const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 118;
      scroller.scrollTo({ top, behavior: 'smooth' });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, []);

  // Original: auto-scroll the header out on load so the menu (with the sticky
  // search bar and the filter chips) starts on screen. Nearbite 0cca76b:
  // ewAutoScrollIntoMenu().
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (!ready || !restaurant || preparing || autoScrolledRef.current) return undefined;
    if (tab !== 'menu' || menuSearchOpen || focusItem) return undefined;
    if (!Number.isFinite(routeId)) return undefined;
    if ((cachedRestaurant?.scrollTop ?? 0) > 0) return undefined;
    const scroller = scrollRef.current;
    if (!scroller || scroller.scrollTop > 0) return undefined;
    autoScrolledRef.current = true;

    let raf = 0;
    let attempts = 0;
    let cancelled = false;

    const start = () => {
      if (cancelled || !scroller.isConnected) return;
      const bar = document.getElementById('restaurant-filter-bar');
      const menuSection = document.getElementById('menu-pane')?.querySelector('.menu-section') as HTMLElement | null;
      // The reveal gate swaps the skeleton for the menu a few frames after
      // `ready`; wait for the real filter bar instead of guessing a delay.
      if (!bar || !menuSection) {
        attempts += 1;
        if (attempts < 180) raf = requestAnimationFrame(start);
        else autoScrolledRef.current = true;
        return;
      }
      const tsb = document.getElementById('ew-sticky-search');
      const catNav = document.getElementById('cat-nav');
      const gapTop = Math.max(tsb ? tsb.offsetHeight : 0, 62) + Math.max(catNav ? catNav.offsetHeight : 0, 44) + 6;
      const PAD = 44;
      const currentPad = Number.parseFloat(getComputedStyle(menuSection).paddingTop) || 0;
      const extra = Math.max(0, PAD - currentPad);
      const anchorTop =
        bar.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop + extra;
      const maxY = scroller.scrollHeight + extra - scroller.clientHeight;
      const target = Math.round(Math.min(anchorTop - gapTop, maxY));
      if (!(target > 80)) {
        // The reveal gate can still be collapsing the page: keep waiting for
        // the real layout instead of recording a no-op.
        attempts += 1;
        if (attempts < 180) raf = requestAnimationFrame(start);
        else autoScrolledRef.current = true;
        return;
      }
      if (!(scroller.scrollHeight > scroller.clientHeight + 80)) {
        autoScrolledRef.current = true;
        return;
      }
      autoScrolledRef.current = true;

      const section = menuSection;
      section.style.paddingTop = `${PAD}px`;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        scroller.scrollTop = target;
        return;
      }
      const events = ['touchstart', 'wheel', 'keydown', 'mousedown'] as const;
      let animation = 0;
      let stopped = false;
      const detach = () => events.forEach((name) => window.removeEventListener(name, onUser, true));
      function onUser() {
        stopped = true;
        cancelAnimationFrame(animation);
        detach();
        const sentinel = document.getElementById('cat-nav-sentinel');
        if (sentinel && sentinel.getBoundingClientRect().top >= 0) section.style.paddingTop = '0px';
      }
      events.forEach((name) => window.addEventListener(name, onUser, { capture: true, passive: true }));
      const started = performance.now();
      const step = (now: number) => {
        if (stopped) return;
        const progress = Math.min(1, (now - started) / 420);
        scroller.scrollTop = Math.round(target * (1 - (1 - progress) ** 3));
        if (progress < 1) animation = requestAnimationFrame(step);
        else detach();
      };
      animation = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(start);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [cachedRestaurant?.scrollTop, focusItem, menuSearchOpen, preparing, ready, restaurant, routeId, tab]);

  // ?focusItem=<id> jumps to the dish and flashes the same highlight the
  // original uses after leaving the search page.
  useEffect(() => {
    if (!focusItem || !ready) return undefined;
    if (tab !== 'menu') setTab('menu');
    const timer = window.setTimeout(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('.menu-item[data-menu-item-id]')).find(
        (element) => element.dataset.menuItemId === focusItem,
      );
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ew-search-focus-item');
      window.setTimeout(() => target.classList.remove('ew-search-focus-item'), 1800);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusItem, ready, tab]);

  // A page that is no longer the current route keeps rendering, and a store
  // reset can empty its menu for a moment. Swapping to the empty state then
  // collapses the menu list and its footer while the page is still on screen,
  // so keep the last non-empty menu for the life of the page.
  const liveMenu = cachedMenu ?? restaurant?.menu ?? [];
  const lastMenuRef = useRef(liveMenu);
  if (liveMenu.length) lastMenuRef.current = liveMenu;
  const menu = liveMenu.length ? liveMenu : lastMenuRef.current;
  const groups = useMemo<MenuGroup[]>(() => {
    if (!restaurant) return [];
    const grouped = new Map<string, MenuItem[]>();
    menu.forEach((menuItem) => {
      const name = menuItem.category?.trim() || 'Recommended';
      const list = grouped.get(name);
      if (list) list.push(menuItem);
      else grouped.set(name, [menuItem]);
    });
    return Array.from(grouped, ([name, items]) => ({ name, items }));
  }, [menu, restaurant]);


  if (!restaurant) {
    return (
      <div className="page rest-page">
        <div className="rest-scroll">
          <div className="top-bar">
            <button type="button" className="ew-hd-circle ew-hd-back" onClick={nav.back} aria-label="Back">
              <Icon name="solid:chevron-left" size={22} />
            </button>
          </div>
          <div className="state-card" style={{ margin: 24 }}>
            <div className="error">Restaurant not found</div>
            <div className="muted">This demo restaurant does not exist.</div>
            <button type="button" className="cta-btn" style={{ marginTop: 18, height: 48 }} onClick={nav.back}>
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rating = Number(restaurant.rating);
  const ratingKnown = Number.isFinite(rating) && rating > 0;
  const ratingCount = compactCount(restaurant.ratingCount);
  const deliveryTime =
    Number.isFinite(restaurant.deliveryMin) && Number.isFinite(restaurant.deliveryMax)
      ? `${restaurant.deliveryMin}\u2013${restaurant.deliveryMax} mins`
      : restaurant.time;
  const distance = `${restaurant.distance} \u00b7 Demo City`;
  const offer = (restaurant.offer || 'UP TO 30% OFF').trim();
  const freeAbove = restaurant.freeDeliveryAbove ?? 399;
  const itemRating = itemCount(restaurant.ratingCount);
  return (
    <div className="page rest-page">
      <div className="rest-scroll" ref={scrollRef} onScroll={handleMenuScroll}>
        <MenuFiltersProvider
          groups={groups}
          rating={rating}
          routeId={routeId}
          preparing={preparing}
          initialFilters={cachedRestaurant?.filters}
          initialQuery={cachedRestaurant?.query}
          initialCollapsed={cachedRestaurant?.collapsed}
        >
        <div className="top-bar ew-themed-header">
          <button type="button" className="ew-hd-circle ew-hd-back" onClick={nav.back} aria-label="Back">
            <Icon name="solid:chevron-left" size={22} />
          </button>
          <div className="top-actions">
            <button
              type="button"
              className="ew-hd-search"
              id="menu-search-btn"
              aria-expanded={menuSearchOpen}
              aria-label="Search dishes in this restaurant"
              onClick={() => setMenuSearchOpen(true)}
            >
              <Icon name="solid:magnifying-glass" size={19} />
              <span>Search</span>
            </button>
            <button
              type="button"
              className="ew-hd-circle"
              aria-label="Save restaurant"
              aria-pressed={saved}
              onClick={() => {
                setSaved((value) => !value);
                toast(saved ? 'Removed from favourites' : 'Added to favourites');
              }}
            >
              <Icon name={saved ? 'solid:heart' : 'regular:heart'} size={22} />
            </button>
          </div>
        </div>

        <div className="res-card">
          <div className="res-card-body">
            <div className="ew-res-head">
              <div className="ew-res-head-main">
                <div className="ew-name-row">
                  <h1 className="res-name" id="res-name">
                    {restaurant.name}
                  </h1>
                  {restaurant.verified !== false && (
                    <svg
                      className="ew-verified"
                      id="res-verified"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      role="img"
                      aria-label="Verified restaurant"
                    >
                      <path
                        fill="currentColor"
                        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
                      />
                      <path
                        d="M8.2 12.4l2.6 2.6 5-5.4"
                        fill="none"
                        stroke="var(--ew-verified-check,#fff)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <p className="res-cuisine" id="res-cuisine">
                  {restaurant.cuisine}
                </p>
                <div className="ew-info-row ew-dist" id="res-distance">
                  <Icon name="solid:location-dot" size={17} />
                  <span>{distance}</span>
                </div>
                <div className="ew-info-row ew-time" id="res-time">
                  <Icon name="solid:bolt-lightning" size={17} />
                  <span>{deliveryTime}</span>
                </div>
              </div>
              <div className="ew-hd-rbox">
                <div
                  className="ew-hd-pill"
                  id="res-rating-pill"
                  data-tier={ratingKnown && rating >= 3.5 ? 'good' : 'low'}
                  aria-label="Restaurant rating"
                >
                  <span className="ew-hd-num" id="res-rating-num">
                    {ratingKnown ? rating.toFixed(1) : 'New'}
                  </span>
                  {ratingKnown && (
                    <span className="ew-hd-star" aria-hidden="true">
                      <svg height="15" width="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M12 3.6l2.48 5.02 5.54.81-4.01 3.91.95 5.52L12 16.25l-4.96 2.61.95-5.52-4.01-3.91 5.54-.81L12 3.6z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                {ratingCount && (
                  <span className="ew-hd-count" id="res-rating-count">
                    {ratingCount} ratings
                  </span>
                )}
              </div>
            </div>
            {offer && (
              <div className="offer-strip" id="res-offer-banner">
                <div className="offer-icon">
                  <Icon name="solid:tag" size={14} />
                </div>
                <span className="offer-text" id="res-offer-text">
                  {offer}
                </span>
              </div>
            )}
          </div>
          <MenuFreeDeliveryStrip restaurantId={restaurant.id} freeAbove={freeAbove} />
        </div>

        <div className="menu-tabs" id="res-tabs" role="tablist" aria-label="Restaurant sections">
          <button
            type="button"
            className={`menu-tab${tab === 'menu' ? ' active' : ''}`}
            id="res-tab-menu"
            role="tab"
            aria-selected={tab === 'menu'}
            aria-controls="menu-pane"
            onClick={() => setTab('menu')}
          >
            Menu
          </button>
          <button
            type="button"
            className={`menu-tab${tab === 'info' ? ' active' : ''}`}
            id="res-tab-info"
            role="tab"
            aria-selected={tab === 'info'}
            aria-controls="info-pane"
            onClick={() => setTab('info')}
          >
            Info
          </button>
        </div>

        <SlideReveal startedAt={mountedAtRef.current} dataReady={ready} skeleton={<MenuSkeleton groups={groups} />}>
        {tab === 'menu' && (
          <MenuCatNav scrollRef={scrollRef} routeId={routeId} initialActive={cachedRestaurant?.activeCategory ?? 0} />
        )}

        <div className="res-pane" id="menu-pane" role="tabpanel" aria-labelledby="res-tab-menu" hidden={tab !== 'menu'}>
          <MenuFilterBar />

          <MenuSection
            ready={ready}
            preparing={preparing}
            restaurantId={restaurant.id}
            ratingKnown={ratingKnown}
            rating={rating}
            itemRating={itemRating}
          />

          {/* The disclaimer belongs to the menu that is on screen. Rendering it
              while the menu is still being prepared lays it out under a short
              pane and then drops it when the groups arrive — a visible jump of
              the footer during the push into this route. */}
          <footer
            className="rmf"
            id="menu-footer"
            aria-label="Menu information"
            hidden={!ready}
          >
            <section className="rmf-dis" aria-labelledby="rmf-dis-title">
              <h2 className="rmf-dis-title" id="rmf-dis-title">
                Disclaimer :
              </h2>
              <ul className="rmf-dis-list">
                <li>All prices are set directly by the restaurant.</li>
                <li>
                  All nutritional information is indicative, values are per serve as shared by the restaurant
                  and may vary depending on the ingredients and portion size.
                </li>
                <li>An average active adult requires 2,000 kcal energy per day, however, calorie needs may vary.</li>
                <li>All item images are AI generated.</li>
                <li>All item descriptions are AI generated for a better experience.</li>
              </ul>
            </section>
            <button type="button" className="rmf-report" onClick={() => toast('Support is not part of this demo')}>
              <Icon name="solid:circle-exclamation" size={14} />
              <span>Report an issue with the menu</span>
              <Icon name="solid:caret-right" size={12} />
            </button>
            <div className="rmf-fssai" id="rmf-fssai" hidden />
            <div className="rmf-outlet" id="rmf-outlet" hidden />
          </footer>
        </div>

        <div className="res-pane" id="info-pane" role="tabpanel" aria-labelledby="res-tab-info" hidden={tab !== 'info'}>
          <div className="menu-section">
            {!ready ? (
              <div className="info-skeleton" id="info-skeleton">
                <div className="skeleton" style={{ height: 22, width: '52%', marginBottom: 14, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 15, width: '74%', marginBottom: 10, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 15, width: '40%', marginBottom: 24, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 16, width: '34%', marginBottom: 14, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 15, width: '100%', marginBottom: 11, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 15, width: '92%', marginBottom: 11, borderRadius: 8 }} />
                <div className="skeleton" style={{ height: 15, width: '96%', borderRadius: 8 }} />
              </div>
            ) : (
              <div id="info-content">
                <section className="inf-hero">
                  <div className="inf-hero-top">
                    <h2 className="inf-name">{restaurant.name}</h2>
                    <span className="inf-pill is-open">
                      <i className="inf-pill-dot" aria-hidden="true" />
                      Open now
                    </span>
                  </div>
                  <p className="inf-sub">{restaurant.cuisine}</p>
                  <div className="inf-acts">
                    <button type="button" className="inf-act" onClick={() => toast('Link copied (demo)')}>
                      <Icon name="solid:arrow-up-from-bracket" size={16} />
                      <span>Share</span>
                    </button>
                  </div>
                </section>
                <section className="inf-sec">
                  <span className="inf-sec-title">Services</span>
                  <div className="inf-svc-list">
                    <div className="inf-svc">
                      <span className="inf-svc-ic">
                        <Icon name="solid:bag-shopping" size={18} />
                      </span>
                      <span className="inf-svc-tx">Delivery available</span>
                    </div>
                    <div className="inf-svc">
                      <span className="inf-svc-ic">
                        <Icon name="solid:motorcycle" size={18} />
                      </span>
                      <span className="inf-svc-tx">Free delivery above ₹{freeAbove}</span>
                    </div>
                  </div>
                </section>
                <section className="ew-customer-reviews" id="ew-customer-reviews" aria-label="Customer reviews">
                  <div className="ew-customer-reviews-head">
                    <h3 className="ew-customer-reviews-title">Customer reviews</h3>
                    <span className="ew-customer-reviews-summary" id="ew-customer-reviews-summary" />
                  </div>
                  <div
                    className="ew-customer-reviews-status"
                    id="ew-customer-reviews-status"
                    role="status"
                    aria-live="polite"
                  >
                    No verified customer reviews yet.
                  </div>
                  <div id="ew-customer-reviews-list" />
                  <button type="button" className="ew-customer-reviews-more" id="ew-customer-reviews-more" hidden>
                    Load more reviews
                  </button>
                </section>
              </div>
            )}
          </div>
          </div>
        </SlideReveal>
        <MenuJump
          scrollRef={scrollRef}
          onClickCategory={jumpToCategory}
          hidden={tab !== 'menu' || menuSearchOpen || !ready}
        />
        <StickySearchBar
          groups={groups}
          onOpen={() => setMenuSearchOpen(true)}
          onBack={nav.back}
          disabled={menuSearchOpen || tab !== 'menu'}
        />
        <RestaurantSearchPage
          open={menuSearchOpen}
          name={restaurant.name}
          groups={groups}
          resId={restaurant.id}
          onClose={closeSearch}
          onCategory={jumpToCategory}
        />
        </MenuFiltersProvider>
      </div>

    </div>
  );
}
