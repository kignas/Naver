import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { findRestaurant } from '../data/demo';
import type { MenuItem } from '../data/demo';
import { useCachedReady } from '../hooks/useCachedReady';
import { useAppNav } from '../lib/navigation';
import { useCustomize } from '../lib/customizeContext';
import { customizedQtyFor, isCustomisable } from '../lib/customization';
import { useAppStore } from '../store/appStore';
import { useUiStore } from '../store/uiStore';
import { toast } from '../store/toastStore';
import restaurantBundleCss from '../styles/original/restaurant.bundle.css?raw';
import restaurantShellCss from '../styles/original/restaurant-shell.css?raw';
import '../styles/pages/restaurant.css';

type MenuFilter = 'popular' | 'rating' | 'price' | 'veg' | 'nonveg';
type MenuTab = 'menu' | 'info';

interface MenuGroup {
  name: string;
  items: MenuItem[];
}

const FILTER_CHIPS: { id: MenuFilter; label: string; className?: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'rating', label: '4.0+ rating' },
  { id: 'price', label: '₹99–₹149' },
  { id: 'veg', label: 'Veg', className: 'veg-chip veg-type diet-chip' },
  { id: 'nonveg', label: 'Non-veg', className: 'veg-chip nonveg-type diet-chip' },
];

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

function categoryId(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `cat-${slug || 'menu'}-${index}`;
}

export function Restaurant() {
  const { id } = useParams<{ id: string }>();
  const routeId = Number(id);
  const restaurant = findRestaurant(id);
  const nav = useAppNav();
  const ready = useCachedReady(`restaurant:${routeId}`, 400, 400);
  const cachedRestaurant = useUiStore.getState().restaurants[routeId];
  const cachedMenu = useUiStore((s) => s.menus[routeId]);
  const patchRestaurant = useUiStore((s) => s.patchRestaurant);
  const cart = useAppStore((s) => s.cart);
  const addItem = useAppStore((s) => s.addItem);
  const decrementItem = useAppStore((s) => s.decrementItem);
  const removeCustomizedUnit = useAppStore((s) => s.removeCustomizedUnit);
  const { openCustomize } = useCustomize();
  const selectRestaurant = useAppStore((s) => s.selectRestaurant);

  const [tab, setTab] = useState<MenuTab>(cachedRestaurant?.tab ?? 'menu');
  const [filters, setFilters] = useState<Set<MenuFilter>>(
    () => new Set((cachedRestaurant?.filters ?? []) as MenuFilter[]),
  );
  const [query, setQuery] = useState(cachedRestaurant?.query ?? '');
  const [menuSearchOpen, setMenuSearchOpen] = useState(cachedRestaurant?.menuSearchOpen ?? false);
  const [saved, setSaved] = useState(cachedRestaurant?.saved ?? false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(cachedRestaurant?.collapsed ?? []));
  const [activeCategory, setActiveCategory] = useState(cachedRestaurant?.activeCategory ?? 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.navereatRestaurant = 'true';
    style.textContent = `${restaurantBundleCss}\n${restaurantShellCss}`;
    document.head.appendChild(style);
    document.body.classList.add('navereat-restaurant');
    document.documentElement.dataset.ewHeader = 'raspberry';
    document.documentElement.dataset.ewTheme = 'light';
    return () => {
      style.remove();
      document.body.classList.remove('navereat-restaurant');
    };
  }, []);

  useEffect(() => {
    if (!restaurant) return;
    selectRestaurant(restaurant.id);
    document.title = `${restaurant.name} – Navereat`;
    return () => {
      document.title = 'Navereat';
    };
  }, [restaurant, selectRestaurant]);

  useEffect(() => {
    if (!Number.isFinite(routeId)) return;
    patchRestaurant(routeId, {
      tab,
      filters: [...filters],
      query,
      menuSearchOpen,
      saved,
      collapsed: [...collapsed],
      activeCategory,
    });
  }, [activeCategory, collapsed, filters, menuSearchOpen, patchRestaurant, query, routeId, saved, tab]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !ready) return;
    scroller.scrollTop = cachedRestaurant?.scrollTop ?? 0;
  }, [cachedRestaurant?.scrollTop, ready, routeId]);

  useEffect(() => {
    if (menuSearchOpen) searchRef.current?.focus();
  }, [menuSearchOpen]);

  const menu = useMemo(() => cachedMenu ?? restaurant?.menu ?? [], [cachedMenu, restaurant]);
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

  const visibleGroups = useMemo(() => {
    const search = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((menuItem) => {
          if (filters.has('popular') && !menuItem.bestseller) return false;
          if (filters.has('rating') && Number(restaurant?.rating ?? 0) < 4) return false;
          if (filters.has('price') && (menuItem.price < 99 || menuItem.price > 149)) return false;
          if (filters.has('veg') && !menuItem.isVeg) return false;
          if (filters.has('nonveg') && menuItem.isVeg) return false;
          if (search && !`${menuItem.name} ${menuItem.desc}`.toLowerCase().includes(search)) return false;
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [filters, groups, query, restaurant]);

  const empty = ready && visibleGroups.length === 0;

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
  const restaurantSubtotal = Object.values(cart)
    .filter((line) => line.resId === restaurant.id)
    .reduce((sum, line) => sum + line.price * line.quantity, 0);
  const freeDeliveryUnlocked = restaurantSubtotal >= freeAbove;
  const freeDeliveryAmount = Math.max(0, freeAbove - restaurantSubtotal);

  const toggleFilter = (filter: MenuFilter) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const resetFilters = () => {
    setFilters(new Set());
    setQuery('');
  };

  const toggleCategory = (name: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const scrollToCategory = (index: number) => {
    const group = visibleGroups[index];
    const scroller = scrollRef.current;
    if (!group || !scroller) return;
    const target = document.getElementById(categoryId(group.name, index));
    if (!target) return;
    const top =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 118;
    scroller.scrollTo({ top, behavior: 'smooth' });
    setActiveCategory(index);
  };

  const handleMenuScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller || !visibleGroups.length) return;
    const threshold = scroller.scrollTop + 145;
    let next = 0;
    visibleGroups.forEach((group, index) => {
      const target = document.getElementById(categoryId(group.name, index));
      if (!target) return;
      const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      if (top <= threshold) next = index;
    });
    if (next !== activeCategory) setActiveCategory(next);
    patchRestaurant(routeId, { scrollTop: scroller.scrollTop, activeCategory: next });
  };

  return (
    <div className="page rest-page">
      <div className="rest-scroll" ref={scrollRef} onScroll={handleMenuScroll}>
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

        {menuSearchOpen && (
          <div className="menu-search-inline" id="menu-search-row">
            <label className="menu-search-inline-field" htmlFor="menu-search-input">
              <Icon name="solid:magnifying-glass" size={16} />
              <input
                id="menu-search-input"
                ref={searchRef}
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="Search dishes in this menu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  id="menu-search-clear"
                  className="menu-search-clear"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                >
                  <Icon name="solid:xmark" size={14} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="menu-search-cancel"
              onClick={() => {
                setMenuSearchOpen(false);
                setQuery('');
              }}
            >
              Cancel
            </button>
          </div>
        )}

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
          <div className="delivery-strip">
            <div className="delivery-banner-line" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="delivery-copy">
              <span className="del-chip" id="res-free-delivery">
                <span className={freeDeliveryUnlocked ? 'is-free' : ''}>
                  {freeDeliveryUnlocked ? (
                    'Free delivery unlocked'
                  ) : (
                    <>
                      Add <strong>₹{freeDeliveryAmount}</strong> more to unlock free delivery
                    </>
                  )}
                </span>
              </span>
            </div>
            <div className="delivery-rider" aria-hidden="true">
              <svg id="delivery-rider-fallback" role="presentation" viewBox="0 0 110 58">
                <g fill="none" stroke="none">
                  <circle cx="80" cy="43" fill="#222936" r="9" />
                  <circle cx="32" cy="43" fill="#222936" r="9" />
                  <path
                    d="M31 42h26l8-17h15l8 9H70l-8 8H43"
                    style={{ fill: 'var(--hd-primary,#E9546B)' }}
                  />
                  <path
                    d="M61 25c5-8 12-12 19-11 5 1 8 5 9 9l-10 3-7-5-5 8z"
                    style={{ fill: 'var(--hd-primary,#E9546B)' }}
                  />
                  <circle cx="82" cy="10" fill="#151A24" r="6" />
                  <path d="M79 16c-3 5-5 11-4 16l10 2 5-10-5-7z" fill="#1D8F62" />
                  <path d="M76 22l-13 7" stroke="#151A24" strokeLinecap="round" strokeWidth="3" />
                  <path d="M90 20l8 6" stroke="#151A24" strokeLinecap="round" strokeWidth="3" />
                </g>
              </svg>
            </div>
            <div className="order-hint" id="order-hint" hidden />
          </div>
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
          <>
            <div className="cat-nav-sentinel" id="cat-nav-sentinel" />
            <div className="cat-nav" id="cat-nav" aria-hidden="true">
              <div className="cat-nav-inner" id="cat-nav-inner">
                {visibleGroups.map((group, index) => (
                  <div
                    key={group.name}
                    className={`cat-nav-pill${activeCategory === index ? ' active' : ''}`}
                    data-target={categoryId(group.name, index)}
                    onClick={() => scrollToCategory(index)}
                  >
                    {group.name}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="res-pane" id="menu-pane" role="tabpanel" aria-labelledby="res-tab-menu" hidden={tab !== 'menu'}>
          <div className="filter-bar ew-menu-quick-filters" id="restaurant-filter-bar" aria-label="Quick menu filters">
            <div className="ew-filter-chip-row" id="quick-filter-row">
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`ew-filter-chip${chip.className ? ` ${chip.className}` : ''}${
                    filters.has(chip.id) ? ' active' : ''
                  }`}
                  id={`filter-${chip.id}`}
                  aria-pressed={filters.has(chip.id)}
                  onClick={() => toggleFilter(chip.id)}
                >
                  {(chip.id === 'veg' || chip.id === 'nonveg') && (
                    <span className="veg-dot-icon" aria-hidden="true" />
                  )}
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="menu-section">
            {!ready && (
              <div id="menu-skeleton">
                <div className="skeleton" style={{ height: 20, width: 130, marginBottom: 16 }} />
                {[0, 1].map((row) => (
                  <div className="skel-item" key={row}>
                    <div className="skel-left">
                      <div className="skeleton" style={{ height: 14, width: 56, borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 16, width: row === 0 ? '62%' : '48%' }} />
                      <div className="skeleton" style={{ height: 15, width: 52 }} />
                      <div className="skeleton" style={{ height: 12, width: row === 0 ? '92%' : '78%' }} />
                    </div>
                    <div className="skel-media">
                      <div className="skeleton skel-img" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div id="menu-container" style={{ display: ready ? 'block' : 'none' }}>
              {visibleGroups.map((group, groupIndex) => {
                const groupCollapsed = collapsed.has(group.name);
                return (
                  <div className="menu-cat-group" id={categoryId(group.name, groupIndex)} key={group.name}>
                    <div
                      className={`menu-cat-header${groupCollapsed ? ' collapsed' : ''}`}
                      onClick={() => toggleCategory(group.name)}
                    >
                      <span className="menu-cat-title">
                        {group.name} <span className="menu-cat-count">({group.items.length})</span>
                      </span>
                      <Icon name="solid:chevron-down" size={14} className="menu-cat-chevron" />
                    </div>
                    <div className={`menu-cat-items${groupCollapsed ? ' collapsed' : ''}`}>
                      {group.items.map((menuItem, itemIndex) => {
                        const qty = cart[menuItem.name]?.quantity ?? 0;
                        const customisable = isCustomisable(menuItem);
                        const customQty = customisable ? customizedQtyFor(cart, menuItem) : 0;
                        const originalPrice =
                          menuItem.originalPrice && menuItem.originalPrice > menuItem.price
                            ? menuItem.originalPrice
                            : null;
                        const discount =
                          menuItem.discountPercent ??
                          (originalPrice ? Math.round((1 - menuItem.price / originalPrice) * 100) : 0);
                        return (
                          <div
                            className="menu-item nb-menu-item"
                            data-menu-item-id={menuItem.id}
                            data-veg={menuItem.isVeg ? 'true' : 'false'}
                            data-veg-known="true"
                            data-egg="false"
                            data-reordered="false"
                            data-price={menuItem.price}
                            data-popular={menuItem.bestseller ? 'true' : 'false'}
                            key={menuItem.id}
                            style={{ animationDelay: `${(groupIndex * 10 + itemIndex) * 0.04}s` }}
                          >
                            <div className="nb-item-main">
                              {menuItem.bestseller && (
                                <div className="nb-item-tag-row">
                                  <span className="nb-item-badge">Bestseller</span>
                                </div>
                              )}
                              <div className="nb-item-title-row">
                                <span
                                  className={`nb-veg-mark ${menuItem.isVeg ? 'veg' : 'nonveg'}`}
                                  title={menuItem.isVeg ? 'Veg' : 'Non-veg'}
                                  aria-label={menuItem.isVeg ? 'Veg' : 'Non-veg'}
                                >
                                  <span />
                                </span>
                                <h3 className="nb-item-title">{menuItem.name}</h3>
                              </div>
                              <div className="nb-item-price-row">
                                <span className={`nb-item-current-price${originalPrice ? ' has-offer' : ''}`}>
                                  <span className="nb-rupee">₹</span>
                                  {menuItem.price}
                                </span>
                                {originalPrice && (
                                  <>
                                    <span className="nb-item-original-price">₹{originalPrice}</span>
                                    <span className="nb-item-discount">{discount}% OFF</span>
                                  </>
                                )}
                              </div>
                              {ratingKnown && (
                                <div className="nb-item-rating" aria-label={`Rating ${rating.toFixed(1)}`}>
                                  <span className="nb-item-rating-star" aria-hidden="true">
                                    ★
                                  </span>
                                  <span className="nb-item-rating-value">{rating.toFixed(1)}</span>
                                  {itemRating && <span className="nb-item-rating-count">({itemRating})</span>}
                                </div>
                              )}
                              {menuItem.desc && <p className="nb-item-desc">{menuItem.desc}</p>}
                            </div>
                            <div className="nb-item-media">
                              <div className={`nb-item-image-wrap${menuItem.image ? ' is-loading' : ''}`}>
                                <div className="nb-item-image-placeholder ew-food-ph" aria-hidden="true" />
                                {menuItem.image && (
                                  <img
                                    className="nb-item-image"
                                    width="128"
                                    height="88"
                                    src={menuItem.image}
                                    alt={menuItem.name}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={(event) => {
                                      event.currentTarget.classList.add('is-loaded');
                                      event.currentTarget.closest('.nb-item-image-wrap')?.classList.remove('is-loading');
                                    }}
                                    onError={(event) => {
                                      event.currentTarget.closest('.nb-item-image-wrap')?.classList.remove('is-loading');
                                      event.currentTarget.remove();
                                    }}
                                  />
                                )}
                              </div>
                              <div className="nb-item-cta" id={`btn-container-${menuItem.id}`}>
                                {customisable ? (
                                  customQty > 0 ? (
                                    <div className="nb-custom-cart-control">
                                      <button
                                        type="button"
                                        className="nb-custom-remove"
                                        onClick={() => removeCustomizedUnit(menuItem)}
                                        aria-label={`Remove one ${menuItem.name} from cart`}
                                      >
                                        −
                                      </button>
                                      <button
                                        type="button"
                                        className="nb-add-btn nb-add-btn--cust has-cart-qty"
                                        data-menu-item-id={menuItem.id}
                                        aria-label={`Customise ${menuItem.name}, ${customQty} in cart`}
                                        onClick={() => openCustomize(menuItem, restaurant.id)}
                                      >
                                        ADD <span className="nb-add-plus" aria-hidden="true">+</span>
                                        <span className="nb-custom-qty" aria-hidden="true">{customQty}</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="nb-add-btn nb-add-btn--cust"
                                      data-menu-item-id={menuItem.id}
                                      aria-label={`Customise ${menuItem.name}`}
                                      onClick={() => openCustomize(menuItem, restaurant.id)}
                                    >
                                      ADD <span className="nb-add-plus" aria-hidden="true">+</span>
                                    </button>
                                  )
                                ) : qty > 0 ? (
                                  <div className="nb-qty" role="group" aria-label="Quantity">
                                    <button
                                      type="button"
                                      className="nb-qty-btn"
                                      onClick={() => decrementItem(menuItem.name)}
                                      aria-label="Decrease quantity"
                                    >
                                      −
                                    </button>
                                    <span className="nb-qty-val">{qty}</span>
                                    <button
                                      type="button"
                                      className="nb-qty-btn"
                                      onClick={() => addItem(menuItem, restaurant.id)}
                                      aria-label="Increase quantity"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="nb-add-btn"
                                    onClick={() => addItem(menuItem, restaurant.id)}
                                    aria-label={`Add ${menuItem.name} to cart`}
                                  >
                                    ADD
                                  </button>
                                )}
                              </div>
                              <div className={customisable ? 'nb-item-customisable' : 'nb-item-customisable nb-item-customisable-spacer'}>
                                {customisable ? 'Customisable' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="empty-filter-msg" id="empty-filter-msg" style={{ display: empty ? 'block' : 'none' }}>
              <Icon name="solid:sliders" size={32} className="empty-filter-icon" />
              <p id="empty-filter-title">No dishes match these filters</p>
              <p id="empty-filter-sub">Try changing your filters.</p>
              <button
                type="button"
                className="empty-filter-clear"
                id="empty-filter-clear"
                onClick={resetFilters}
                hidden={filters.size === 0 && !query}
              >
                Clear filters
              </button>
            </div>
          </div>

          <footer className="rmf" id="menu-footer" aria-label="Menu information">
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
      </div>

    </div>
  );
}
