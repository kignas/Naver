import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CartBar } from '../components/CartBar';
import { Icon } from '../components/Icon';
import { QtyControl } from '../components/QtyControl';
import { VegDot } from '../components/VegDot';
import { findRestaurant } from '../data/demo';
import { useSkeleton } from '../hooks/useSkeleton';
import { useAppNav } from '../lib/navigation';
import { formatMoney } from '../lib/money';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import '../styles/pages/restaurant.css';

type MenuFilter = 'all' | 'veg' | 'nonveg' | 'bestseller';

const FILTERS: { id: MenuFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'veg', label: 'Veg' },
  { id: 'nonveg', label: 'Non-Veg' },
  { id: 'bestseller', label: 'Bestseller' },
];

export function Restaurant() {
  const { id } = useParams<{ id: string }>();
  const restaurant = findRestaurant(id);
  const nav = useAppNav();
  const cart = useAppStore((s) => s.cart);
  const addItem = useAppStore((s) => s.addItem);
  const decrementItem = useAppStore((s) => s.decrementItem);
  const ready = useSkeleton(400, 700);
  const [filter, setFilter] = useState<MenuFilter>('all');
  const [liked, setLiked] = useState(false);

  const items = useMemo(() => {
    if (!restaurant) return [];
    return restaurant.menu.filter((item) => {
      if (filter === 'veg') return item.isVeg;
      if (filter === 'nonveg') return !item.isVeg;
      if (filter === 'bestseller') return item.bestseller === true;
      return true;
    });
  }, [restaurant, filter]);

  if (!restaurant) {
    return (
      <div className="page rest-page">
        <div className="page-scroll">
          <div className="rest-topbar">
            <button type="button" className="icon-btn tap" onClick={nav.back} aria-label="Back">
              <Icon name="solid:chevron-left" size={14} />
            </button>
          </div>
          <div className="not-found">
            <Icon name="solid:utensils" size={44} style={{ color: 'var(--g200)', margin: '0 auto' }} />
            <h3>Restaurant not found</h3>
            <p>This demo restaurant does not exist.</p>
            <button type="button" className="not-found-btn" onClick={nav.back}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page rest-page">
      <div className="rest-topbar">
          <button type="button" className="icon-btn tap" onClick={nav.back} aria-label="Back">
            <Icon name="solid:chevron-left" size={14} />
          </button>
          <div className="rest-top-actions">
            <button type="button" className="icon-btn tap" onClick={() => nav.tab('/search')} aria-label="Search">
              <Icon name="solid:magnifying-glass" size={14} />
            </button>
            <button
              type="button"
              className="icon-btn tap"
              onClick={() => toast('Restaurant link copied (demo)')}
              aria-label="Share"
            >
              <Icon name="solid:share-nodes" size={14} />
            </button>
          </div>
      </div>

      <div className="page-scroll rest-scroll">
        <div className="rest-info">
          <div className="rest-info-card">
            <div className="rest-info-top">
              <div className="rest-info-left">
                <h1 className="rest-title">{restaurant.name}</h1>
                <p className="rest-cuisine">{restaurant.cuisine}</p>
                <div className="rest-meta-row">
                  <span className="rating-badge">
                    <Icon name="solid:star" size={9} /> {restaurant.rating}
                  </span>
                  <span className="meta-dot">•</span>
                  <span className="meta-text">{restaurant.time}</span>
                  <span className="meta-dot">•</span>
                  <span className="meta-text">{restaurant.distance}</span>
                </div>
              </div>
              <button
                type="button"
                className={`heart-btn tap${liked ? ' liked' : ''}`}
                aria-label="Favourite"
                aria-pressed={liked}
                onClick={() => {
                  setLiked((value) => !value);
                  toast(liked ? 'Removed from favourites' : 'Added to favourites');
                }}
              >
                <Icon name={liked ? 'solid:heart' : 'regular:heart'} size={14} />
              </button>
            </div>

            {restaurant.offer && (
              <div className="offer-banner">
                <div className="offer-line">
                  <Icon name="solid:tag" size={12} style={{ color: 'var(--brand)' }} />
                  <span>{restaurant.offer}</span>
                </div>
              </div>
            )}

            <div className="delivery-info">
              <Icon name="solid:motorcycle" size={13} className="bike" />
              <span>FREE DELIVERY ABOVE ₹149</span>
              <span className="sep">·</span>
              <Icon name="regular:clock" size={12} className="clock" />
              <span>On time delivery</span>
            </div>
          </div>
        </div>

        <div className="menu-wrap">
          <div className="menu-filters">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`filter-pill${filter === entry.id ? ' active' : ''}`}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {!ready ? (
            <div>
              <div className="skeleton" style={{ height: 20, width: 160, borderRadius: 4, marginBottom: 24 }} />
              {[0, 1].map((row) => (
                <div className="menu-skeleton-row" key={row}>
                  <div className="menu-skeleton-lines">
                    <div className="skeleton" style={{ height: 16, width: 128, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 12, width: 96, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 12, width: '100%', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 12, width: '75%', borderRadius: 4 }} />
                  </div>
                  <div className="skeleton" style={{ width: 128, height: 128, borderRadius: 16 }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              <h2 className="menu-heading">
                Recommended <span className="menu-count">({items.length})</span>
              </h2>
              <div className="menu-list">
                {items.map((item, index) => {
                  const qty = cart[item.name]?.quantity ?? 0;
                  return (
                    <div className="menu-item" key={item.id} style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="menu-item-left">
                        {item.bestseller && (
                          <span className="bestseller">
                            <Icon name="solid:star" size={8} /> Bestseller
                          </span>
                        )}
                        <VegDot isVeg={item.isVeg} />
                        <h3 className="menu-name" style={{ marginTop: 6 }}>
                          {item.name}
                        </h3>
                        <p className="menu-price">{formatMoney(item.price)}</p>
                        <p className="menu-desc">{item.desc}</p>
                      </div>
                      <div className="menu-item-img-wrap">
                        <img className="menu-item-img" src={item.image} alt={item.name} />
                        <div className="menu-add">
                          {qty > 0 ? (
                            <QtyControl
                              qty={qty}
                              onAdd={() => addItem(item, restaurant.id)}
                              onRemove={() => decrementItem(item.name)}
                            />
                          ) : (
                            <button
                              type="button"
                              className="add-btn-single"
                              onClick={() => addItem(item, restaurant.id)}
                            >
                              ADD
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--g400)', padding: '32px 0' }}>
                    No dishes match this filter.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CartBar />
    </div>
  );
}
