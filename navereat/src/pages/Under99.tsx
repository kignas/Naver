import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import heroDish from '../assets/placeholders/hero-dish.svg';
import { restaurants, type MenuItem, type Restaurant } from '../data/demo';
import { useCachedReady } from '../hooks/useCachedReady';
import { useCustomize } from '../lib/customizeContext';
import { customizedQtyFor, isCustomisable } from '../lib/customization';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useAppStore } from '../store/appStore';
import { useSearchStore } from '../store/searchStore';
import under99BundleCss from '../styles/original/under99.bundle.css?raw';
import under99PageCss from '../styles/pages/under99.css?raw';

const under99Styles = createRouteStyleSheet(`${under99BundleCss}\n${under99PageCss}`, 'navereatUnder99');

type Band = '99' | '100' | '150';
type FoodType = 'all' | 'veg' | 'nonveg';
type SortMode = 'default' | 'price' | 'rating';

interface StoreEntry {
  item: MenuItem;
  res: Restaurant;
}

const BANDS: Array<{ id: Band; label: string }> = [
  { id: '99', label: '₹99 & under' },
  { id: '100', label: '₹100 – ₹149' },
  { id: '150', label: '₹150 – ₹200' },
];

const ALL_ITEMS: StoreEntry[] = restaurants.flatMap((res) =>
  res.menu.map((item) => ({ item, res })),
);

const inBand = (price: number, band: Band): boolean => {
  if (band === '99') return price <= 99;
  if (band === '100') return price >= 100 && price <= 149;
  return price >= 150 && price <= 200;
};

const deliveryMax = (value: string): number => {
  const numbers = String(value).match(/\d+/g);
  return numbers?.length ? Math.max(...numbers.map(Number)) : Infinity;
};

const discountFor = (item: MenuItem): number => {
  if (item.discountPercent != null) return item.discountPercent;
  if (item.originalPrice && item.originalPrice > item.price) {
    return Math.round((1 - item.price / item.originalPrice) * 100);
  }
  return 0;
};

function U99Icon({ name, size = 22 }: { name: string; size?: number }) {
  let children: ReactNode;
  let fill = 'none';
  let stroke = 'currentColor';
  if (name === 'location') {
    fill = 'currentColor';
    stroke = 'none';
    children = <path d="M12 2.7A7.35 7.35 0 0 0 4.65 10c0 5.35 7.35 11.3 7.35 11.3S19.35 15.35 19.35 10A7.35 7.35 0 0 0 12 2.7Zm0 10.05A2.75 2.75 0 1 1 12 7.25a2.75 2.75 0 0 1 0 5.5Z" />;
  } else if (name === 'star') {
    fill = 'currentColor';
    stroke = 'none';
    children = <path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94z" />;
  } else if (name === 'veg' || name === 'nonveg') {
    children = (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        {name === 'veg'
          ? <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          : <path d="M12 7.5 16.5 15.5h-9z" fill="currentColor" />}
      </>
    );
  } else {
    const paths: Record<string, string[]> = {
      back: ['M19 12H5', 'm12 19-7-7 7-7'],
      search: ['M10.8 10.8m-7.2 0a7.2 7.2 0 1 0 14.4 0a7.2 7.2 0 1 0-14.4 0', 'm16.1 16.1 4.1 4.1'],
      filter: ['M4 7h13', 'M4 17h9'],
      'chevron-down': ['m6 9 6 6 6-6'],
      sort: ['M8 4v16M5 7l3-3 3 3M16 20V4m-3 13 3 3 3-3'],
      plus: ['M12 5v14M5 12h14'],
      minus: ['M5 12h14'],
      clock: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7v5l3.2 1.9'],
    };
    children = (paths[name] ?? []).map((path) => <path key={path} d={path} />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function AddControl({ entry, compact = false }: { entry: StoreEntry; compact?: boolean }) {
  const cart = useAppStore((state) => state.cart);
  const addItem = useAppStore((state) => state.addItem);
  const decrementItem = useAppStore((state) => state.decrementItem);
  const removeCustomizedUnit = useAppStore((state) => state.removeCustomizedUnit);
  const { openCustomize } = useCustomize();
  const qty = customizedQtyFor(cart, entry.item);
  const customisable = isCustomisable(entry.item);
  const size = compact ? 17 : 18;

  const add = () => {
    if (customisable) openCustomize(entry.item, entry.res.id);
    else addItem(entry.item, entry.res.id);
  };
  const remove = () => {
    if (customisable) removeCustomizedUnit(entry.item);
    else decrementItem(entry.item.name);
  };

  return (
    <div className={`u99-add-control${qty > 0 ? ' has-qty' : ''}`}>
      {qty > 0 ? (
        <div className="u99-stepper" role="group" aria-label="Quantity in cart">
          <button type="button" className="u99-step-btn tap" onClick={remove} aria-label={`Remove one ${entry.item.name}`}>
            <U99Icon name="minus" size={size} />
          </button>
          <span className="u99-step-qty" aria-live="polite">{qty}</span>
          <button type="button" className="u99-step-btn tap" onClick={add} aria-label={`Add one ${entry.item.name}`}>
            <U99Icon name="plus" size={size} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`u99-add-btn tap${customisable ? ' has-options' : ''}`}
          onClick={add}
          aria-label={`${customisable ? 'Customise' : 'Add'} ${entry.item.name}`}
        >
          <U99Icon name="plus" size={compact ? 21 : 23} />
        </button>
      )}
    </div>
  );
}

function ProductCard({ entry }: { entry: StoreEntry }) {
  const { item, res } = entry;
  const off = discountFor(item);
  const old = item.originalPrice && item.originalPrice > item.price ? item.originalPrice : null;
  const customisable = isCustomisable(item);

  return (
    <article className="u99-product-card">
      <div className="u99-product-image">
        <img className="u99-item-img is-loaded" src={item.image} alt={item.name} loading="lazy" decoding="async" />
        {(off > 0 || item.bestseller) && (
          <div className="u99-tags">
            {off > 0 && <span className="u99-tag u99-tag-off">{off}% OFF</span>}
            {item.bestseller && <span className="u99-tag u99-tag-best">Bestseller</span>}
          </div>
        )}
        <span className="u99-rating-badge"><U99Icon name="star" size={11} /><span>{res.rating}</span></span>
        <AddControl entry={entry} />
      </div>
      <div className="u99-product-body">
        <div className="u99-name-row">
          <span className={`u99-name-marker ${item.isVeg ? 'veg' : 'nonveg'}`} role="img" aria-label={item.isVeg ? 'Veg' : 'Non-veg'}>
            <U99Icon name={item.isVeg ? 'veg' : 'nonveg'} size={14} />
          </span>
          <h3 className="u99-product-name">{item.name}</h3>
        </div>
        <div className="u99-restaurant-name"><span className="u99-by">by {res.name}</span></div>
        {res.time && <div className="u99-eta"><U99Icon name="clock" size={12} /><span>{res.time}</span></div>}
        <div className="u99-product-price-row">
          <span className="u99-current-price">{formatMoney(item.price)}</span>
          {old && <span className="u99-old-price">{formatMoney(old)}</span>}
        </div>
        {customisable && <span className="u99-custom-hint">Customisable</span>}
      </div>
    </article>
  );
}

export function Under99() {
  const nav = useAppNav();
  const openSearch = useSearchStore((state) => state.openSearch);
  const ready = useCachedReady('under99', 180, 320);
  const [band, setBand] = useState<Band>('99');
  const [foodType, setFoodType] = useState<FoodType>('all');
  const [discountOnly, setDiscountOnly] = useState(false);
  const [deliveryLimit, setDeliveryLimit] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  useLayoutEffect(() => under99Styles.attach(), []);
  useEffect(() => {
    document.documentElement.dataset.ewHeader = 'raspberry';
    document.documentElement.dataset.ewTheme = 'light';
  }, []);

  const filtered = useMemo(() => {
    let list = ALL_ITEMS.filter(({ item, res }) => {
      if (!inBand(item.price, band)) return false;
      if (foodType === 'veg' && !item.isVeg) return false;
      if (foodType === 'nonveg' && item.isVeg) return false;
      if (discountOnly && discountFor(item) < 20) return false;
      if (deliveryLimit != null && deliveryMax(res.time) > deliveryLimit) return false;
      return true;
    });
    if (sortMode === 'price') list = [...list].sort((a, b) => a.item.price - b.item.price);
    if (sortMode === 'rating') list = [...list].sort((a, b) => Number(b.res.rating) - Number(a.res.rating));
    if (sortMode === 'default') {
      list = [...list].sort((a, b) =>
        Number(Boolean(b.item.bestseller)) - Number(Boolean(a.item.bestseller)) ||
        a.item.price - b.item.price,
      );
    }
    return list;
  }, [band, foodType, discountOnly, deliveryLimit, sortMode]);

  const counts = useMemo(() => {
    const output: Record<Band, number> = { '99': 0, '100': 0, '150': 0 };
    ALL_ITEMS.forEach(({ item }) => {
      BANDS.forEach(({ id }) => {
        if (inBand(item.price, id)) output[id] += 1;
      });
    });
    return output;
  }, []);

  const popular = useMemo(
    () => filtered.filter(({ item }) => item.bestseller).slice(0, 12),
    [filtered],
  );

  const cycleDelivery = () => setDeliveryLimit((value) => (value == null ? 30 : value === 30 ? 40 : null));
  const cycleFood = () => setFoodType((value) => (value === 'all' ? 'veg' : value === 'veg' ? 'nonveg' : 'all'));
  const cycleSort = () => setSortMode((value) => (value === 'default' ? 'price' : value === 'price' ? 'rating' : 'default'));
  const bandIndex = BANDS.findIndex((entry) => entry.id === band);

  return (
    <div className="page u99-page">
      <div className="page-scroll u99-scroll">
        <header className="u99-header">
          <section className="u99-hero" aria-label="Meals under ₹99">
            <div className="u99-hero-fallback" aria-hidden="true" />
            <img className="u99-hero-art loaded" src={heroDish} alt="" width="320" height="400" />
            <div className="u99-topbar">
              <button className="u99-circle-btn tap" type="button" onClick={nav.back} aria-label="Back">
                <U99Icon name="back" size={22} />
              </button>
              <button className="u99-location" type="button" aria-label="Change delivery location">
                <span className="u99-location-pin"><U99Icon name="location" size={18} /></span>
                <span className="u99-location-copy">
                  <span className="u99-location-line">
                    <strong className="u99-location-name">Demo City…</strong>
                    <span className="u99-location-chevron"><U99Icon name="chevron-down" size={14} /></span>
                  </span>
                  <span className="u99-location-sub">Delivery in 35–40 minutes</span>
                </span>
              </button>
              <button className="u99-circle-btn u99-search-btn tap" type="button" onClick={() => openSearch('under99')} aria-label="Search">
                <U99Icon name="search" size={22} />
              </button>
            </div>
            <div className="u99-hero-copy">
              <div className="u99-kicker">99 Store</div>
              <h1 className="u99-price">
                <span className="u99-price-lead">Meals under</span>
                <span className="u99-price-amt"><span className="currency">₹</span><span className="number">99</span></span>
              </h1>
              <p className="u99-sub">Great food. Lower prices. Everyday.</p>
            </div>
          </section>
        </header>

        <div className="u99-controls">
          <nav className="u99-filter-rail" aria-label="99 Store filters">
            <button className="u99-filter filter-pill u99-filter-icon tap" type="button" onClick={() => { setDiscountOnly(false); setDeliveryLimit(null); setFoodType('all'); }}>
              <U99Icon name="filter" size={17} /><span className="u99-filter-icon-label">Filters</span>
            </button>
            <button className={`u99-filter filter-pill featured tap${discountOnly ? ' active' : ''}`} type="button" onClick={() => setDiscountOnly((value) => !value)}>
              <span className="u99-percent">%</span>25–60% lower prices
            </button>
            <button className={`u99-filter filter-pill tap${deliveryLimit != null ? ' active' : ''}`} type="button" onClick={cycleDelivery}>
              {deliveryLimit == null ? 'Delivery time' : `Under ${deliveryLimit} mins`} <U99Icon name="chevron-down" size={15} />
            </button>
            <button className={`u99-filter filter-pill tap${foodType !== 'all' ? ' active' : ''}`} type="button" onClick={cycleFood}>
              {foodType === 'all' ? 'Veg / Non-Veg' : foodType === 'veg' ? 'Pure Veg' : 'Non-Veg'} <U99Icon name="chevron-down" size={15} />
            </button>
          </nav>

          <nav className="u99-price-seg" role="tablist" aria-label="Price range">
            <span className="u99-price-thumb" style={{ transform: `translateX(${bandIndex * 100}%)` }} aria-hidden="true" />
            {BANDS.map((entry) => (
              <button
                key={entry.id}
                className={`u99-price-tab tap${band === entry.id ? ' active' : ''}`}
                role="tab"
                aria-selected={band === entry.id}
                type="button"
                onClick={() => setBand(entry.id)}
              >
                <span className="u99-tab-label">{entry.label}</span>
                <span className="u99-tab-count">{counts[entry.id]} dishes</span>
              </button>
            ))}
          </nav>
        </div>

        <main className="u99-page-main">
          <section className="u99-popular" hidden={popular.length < 2} aria-labelledby="u99-popular-title">
            <div className="u99-section-head">
              <h2 id="u99-popular-title" className="u99-section-h">Bestsellers &amp; popular picks</h2>
            </div>
            <div className="u99-popular-rail">
              {popular.map((entry) => (
                <article className="u99-pop-card" key={`${entry.res.id}-${entry.item.id}`}>
                  <div className="u99-pop-image">
                    <img src={entry.item.image} alt={entry.item.name} loading="lazy" decoding="async" />
                    <AddControl entry={entry} compact />
                  </div>
                  <div className="u99-pop-name">
                    <span className={`u99-name-marker ${entry.item.isVeg ? 'veg' : 'nonveg'}`} aria-hidden="true">
                      <U99Icon name={entry.item.isVeg ? 'veg' : 'nonveg'} size={13} />
                    </span>
                    <span>{entry.item.name}</span>
                  </div>
                  <div className="u99-pop-meta">
                    <span className="u99-pop-price">{formatMoney(entry.item.price)}</span>
                    <span className="u99-pop-rating"><U99Icon name="star" size={11} /> {entry.res.rating}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="u99-products-head">
              <h2 className="u99-products-title">All {filtered.length} {filtered.length === 1 ? 'item' : 'items'}</h2>
              <button className="u99-sort tap" type="button" onClick={cycleSort}>
                <U99Icon name="sort" size={15} />
                <span>{sortMode === 'default' ? 'Sort' : sortMode === 'price' ? 'Price' : 'Rating'}</span>
              </button>
            </div>
            {!ready ? (
              <div className="u99-skeleton">
                <div className="u99-skel-grid">
                  {[0, 1, 2, 3].map((key) => (
                    <div className="u99-skel-card" key={key}>
                      <span className="u99-skel-img u99-shimmer" />
                      <span className="u99-skel-line u99-shimmer" />
                      <span className="u99-skel-line short u99-shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="u99-empty">
                <strong>No dishes match these filters</strong>
                <span>Try another price range or remove a filter.</span>
              </div>
            ) : (
              <div className="u99-product-grid" id="u99-product-grid">
                {filtered.map((entry) => <ProductCard key={`${entry.res.id}-${entry.item.id}`} entry={entry} />)}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
