import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import { QtyControl } from '../components/QtyControl';
import { VegDot } from '../components/VegDot';
import { restaurants, type MenuItem } from '../data/demo';
import { useSkeleton } from '../hooks/useSkeleton';
import { useAppNav } from '../lib/navigation';
import { formatMoney } from '../lib/money';
import { useAppStore } from '../store/appStore';
import '../styles/pages/under99.css';

interface StoreItem {
  item: MenuItem;
  resId: number;
  resName: string;
  resRating: string;
}

const ALL_ITEMS: StoreItem[] = restaurants.flatMap((restaurant) =>
  restaurant.menu.map((item) => ({
    item,
    resId: restaurant.id,
    resName: restaurant.name,
    resRating: restaurant.rating,
  })),
);

const formatCountdown = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function Under99() {
  const nav = useAppNav();
  const ready = useSkeleton(400, 700);
  const cart = useAppStore((s) => s.cart);
  const addItem = useAppStore((s) => s.addItem);
  const decrementItem = useAppStore((s) => s.decrementItem);
  const [maxPrice, setMaxPrice] = useState<99 | 149>(99);
  const [vegOnly, setVegOnly] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [sortRating, setSortRating] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [seconds, setSeconds] = useState(3 * 60 * 60);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo(() => {
    let list = ALL_ITEMS.filter(({ item }) =>
      maxPrice === 99 ? item.price <= 99 : item.price > 99 && item.price <= 149,
    );
    if (vegOnly) list = list.filter((entry) => entry.item.isVeg);
    if (ratingOnly) list = list.filter((entry) => parseFloat(entry.resRating) >= 4);
    if (sortRating) list = [...list].sort((a, b) => parseFloat(b.resRating) - parseFloat(a.resRating));
    return list;
  }, [maxPrice, vegOnly, ratingOnly, sortRating]);

  const changePrice = (value: 99 | 149) => {
    if (value === maxPrice) return;
    setMaxPrice(value);
    setFiltering(true);
    window.setTimeout(() => setFiltering(false), 350);
  };

  const showSkeleton = !ready || filtering;

  return (
    <div className="page u99-page">
      <header className="u99-header">
          <div className="u99-header-inner">
            <div className="u99-top">
              <div className="u99-title-wrap">
                <button type="button" className="u99-back tap" onClick={() => nav.tab('/')} aria-label="Back">
                  <Icon name="solid:arrow-left" size={14} />
                </button>
                <div>
                  <div className="u99-title-row">
                    <h1 className="u99-title">₹99 Store</h1>
                    <span className="u99-official">OFFICIAL</span>
                  </div>
                  <p className="u99-sub">Quality Guaranteed</p>
                </div>
              </div>
              <div className="u99-actions">
                <button type="button" className="icon-btn tap" onClick={() => nav.tab('/search')} aria-label="Search">
                  <Icon name="solid:magnifying-glass" size={12} />
                </button>
                <button type="button" className="icon-btn tap" aria-label="Share">
                  <Icon name="solid:share-nodes" size={12} />
                </button>
              </div>
            </div>

            <div className="u99-filters">
              <button
                type="button"
                className={`filter-pill${maxPrice === 99 ? ' active' : ''}`}
                onClick={() => changePrice(99)}
              >
                ₹99 Store
              </button>
              <button
                type="button"
                className={`filter-pill${maxPrice === 149 ? ' active' : ''}`}
                onClick={() => changePrice(149)}
              >
                ₹149 Store
              </button>
              <span className="u99-divider" />
              <button
                type="button"
                className={`filter-pill${sortRating ? ' active' : ''}`}
                onClick={() => setSortRating((value) => !value)}
              >
                Sort <Icon name="solid:chevron-down" size={8} />
              </button>
              <button
                type="button"
                className={`filter-pill${ratingOnly ? ' active' : ''}`}
                onClick={() => setRatingOnly((value) => !value)}
              >
                Ratings 4.0+
              </button>
            </div>
          </div>

          <div className="u99-subbar">
            <div className="row" style={{ gap: 8 }}>
              <span className="u99-veg-label">VEG ONLY</span>
              <button
                type="button"
                className={`veg-toggle${vegOnly ? ' on' : ''}`}
                aria-pressed={vegOnly}
                aria-label="Veg only"
                onClick={() => setVegOnly((value) => !value)}
              >
                <span className="veg-thumb" />
              </button>
            </div>
            <div className="u99-countdown">
              <span className="u99-dot" />
              <p className="u99-timer">ENDS IN {formatCountdown(seconds)}</p>
            </div>
          </div>
      </header>

      <div className="page-scroll u99-scroll">
        <main className="u99-main">
          <p className="u99-count">{showSkeleton ? '– ITEMS FOUND' : `${items.length} ITEMS FOUND`}</p>

          {showSkeleton ? (
            <div className="u99-grid">
              {[0, 1, 2, 3].map((key) => (
                <div className="u99-skeleton" key={key}>
                  <div className="skeleton u99-skeleton-img" />
                  <div className="skeleton u99-skeleton-line" />
                  <div className="skeleton u99-skeleton-line" style={{ width: '50%' }} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--g400)' }}>
              <Icon name="solid:bowl-food" size={44} style={{ color: 'var(--g200)', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--g700)' }}>No items found</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Try changing filters</p>
            </div>
          ) : (
            <div className="u99-grid">
              {items.map(({ item, resId, resName, resRating }) => {
                const qty = cart[item.name]?.quantity ?? 0;
                return (
                  <div className="u99-card" key={`${resId}-${item.id}`}>
                    <div className="u99-img-wrap">
                      <img className="u99-img" src={item.image} alt={item.name} />
                      <div className="u99-add">
                        {qty > 0 ? (
                          <QtyControl
                            qty={qty}
                            onAdd={() => addItem(item, resId)}
                            onRemove={() => decrementItem(item.name)}
                          />
                        ) : (
                          <button type="button" className="add-btn-single" onClick={() => addItem(item, resId)}>
                            ADD
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="u99-body">
                      <div className="u99-meta">
                        <VegDot isVeg={item.isVeg} />
                        <span className="u99-rating">
                          <Icon name="solid:star" size={8} /> {resRating}
                        </span>
                      </div>
                      <h3 className="u99-name">{item.name}</h3>
                      <p className="u99-res">{resName}</p>
                      <p className="u99-price">{formatMoney(item.price)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
