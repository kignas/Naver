import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MenuCatNav } from '../components/menu/MenuCatNav';
import { MenuFilterBar } from '../components/menu/MenuFilterBar';
import { MenuFiltersProvider } from '../components/menu/MenuFiltersProvider';
import { MenuFreeDeliveryStrip } from '../components/menu/MenuFreeDeliveryStrip';
import { MenuSearchRow } from '../components/menu/MenuSearchRow';
import { MenuSection } from '../components/menu/MenuSection';
import type { MenuGroup } from '../components/menu/menuTypes';
import { findRestaurant } from '../data/demo';
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
import '../styles/pages/restaurant.css';

const restaurantStyle = createRouteStyleSheet(`${restaurantBundleCss}\n${restaurantShellCss}`, 'navereatRestaurant');

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
  const resolvedRestaurant = findRestaurant(id);
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

  useLayoutEffect(() => {
    const detach = restaurantStyle.attach();
    document.body.classList.add('navereat-restaurant');
    document.documentElement.dataset.ewHeader = 'raspberry';
    document.documentElement.dataset.ewTheme = 'light';
    return () => {
      detach();
      document.body.classList.remove('navereat-restaurant');
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

  const closeSearch = useCallback(() => setMenuSearchOpen(false), []);

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
              onClick={() => setMenuSearchOpen((value) => !value)}
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

        {menuSearchOpen && <MenuSearchRow preparing={preparing} onClose={closeSearch} />}

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
                  <p className="inf-sub">
                    {restaurant.cuisine}
                    <span className="inf-sep" aria-hidden="true" />₹{restaurant.priceForTwo} for two
                  </p>
                  <div className="inf-acts">
                    <button type="button" className="inf-act" onClick={() => toast('Link copied (demo)')}>
                      <Icon name="solid:arrow-up-from-bracket" size={16} />
                      <span>Share</span>
                    </button>
                  </div>
                </section>
                <section className="inf-sec inf-addr">
                  <span className="inf-sec-ic">
                    <Icon name="solid:location-dot" size={18} />
                  </span>
                  <div>
                    <span className="inf-sec-title">Address</span>
                    <p className="inf-addr-tx">42 Demo Street, Demo City, 735101</p>
                  </div>
                </section>
                <section className="inf-sec">
                  <span className="inf-sec-ic">
                    <Icon name="regular:clock" size={18} />
                  </span>
                  <div>
                    <span className="inf-sec-title">Opening hours</span>
                    <p className="inf-addr-tx">Every day 10:00 AM – 11:00 PM</p>
                  </div>
                </section>
                <section className="inf-sec">
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
                </section>
              </div>
            )}
          </div>
          </div>
        </MenuFiltersProvider>
      </div>

    </div>
  );
}
