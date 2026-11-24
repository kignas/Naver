import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import type { MenuItem, Restaurant } from '../data/demo';
import type { Cart } from '../lib/cart';
import { customizedQtyFor, isCustomisable } from '../lib/customization';

interface HomeRestaurantCardProps {
  restaurant: Restaurant;
  /**
   * Position of the restaurant in the unfiltered feed. Filtering and sorting
   * must not shift it: the value drives the mount animation delay only, and a
   * shifting value would re-render every card below a filtered-out row.
   */
  staggerIndex: number;
  cart: Cart;
  /** Windowed rows mount mid-scroll, so they must not replay the fade-up. */
  animate?: boolean;
  onOpen: (restaurant: Restaurant) => void;
  onAdd: (restaurant: Restaurant, item: MenuItem) => void;
  onCustomize: (restaurant: Restaurant, item: MenuItem) => void;
  onIncrement: (item: MenuItem, resId: number) => void;
  onDecrement: (name: string) => void;
}

const RATING_BADGE = (
  <svg className="u99-rating-badge" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="var(--ew-success,#23956D)" />
    <path
      d="M12 5.4 13.94 9.33 18.28 9.96 15.14 13.02 15.88 17.34 12 15.3 8.12 17.34 8.86 13.02 5.72 9.96 10.06 9.33Z"
      fill="#fff"
    />
  </svg>
);

const VERIFIED_BADGE = (
  <svg className="u99-verified" viewBox="0 0 24 24" role="img" aria-label="Verified restaurant">
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
);

const OFFER_SEAL = (
  <svg className="u99-seal" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 0.8Q12 0.8 13.3 1.99Q14.59 3.17 16.32 2.88Q18.06 2.58 18.5 4.28Q18.95 5.98 20.57 6.66Q22.19 7.35 21.65 9.02Q21.11 10.69 22.1 12.14Q23.09 13.59 21.73 14.71Q20.37 15.82 20.42 17.58Q20.46 19.33 18.72 19.54Q16.97 19.74 16.06 21.24Q15.16 22.75 13.58 21.97Q12 21.2 10.42 21.97Q8.84 22.75 7.94 21.24Q7.03 19.74 5.28 19.54Q3.54 19.33 3.58 17.58Q3.63 15.82 2.27 14.71Q0.91 13.59 1.9 12.14Q2.89 10.69 2.35 9.02Q1.81 7.35 3.43 6.66Q5.05 5.98 5.5 4.28Q5.94 2.58 7.68 2.88Q9.41 3.17 10.7 1.99Z"
      fill="var(--ew-success,#23956D)"
    />
    <path d="M9 15.2 15 8.8" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="9.4" cy="9.4" r="1.55" fill="#fff" />
    <circle cx="14.6" cy="14.6" r="1.55" fill="#fff" />
  </svg>
);

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const INFO_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 10.7v5.2M12 7.5h.01" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

function formatRatingCount(value?: number): string {
  if (!value || value <= 0) return '';
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}

function formatRating(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(1) : '—';
}

function bestItemDiscount(menu: MenuItem[]): number {
  return Math.round(
    menu.reduce((best, item) => {
      const percent = item.discountPercent;
      const original = item.originalPrice;
      const computed =
        percent != null && percent > 0
          ? percent
          : original != null && original > item.price && item.price > 0
            ? (1 - item.price / original) * 100
            : 0;
      return Math.max(best, computed);
    }, 0),
  );
}

function displayOffer(restaurant: Restaurant): string {
  const raw = (restaurant.offer || '').trim();
  if (raw) {
    const percent = raw.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percent) return `${Math.round(Number(percent[1]))}% LOWER PRICES`;
    if (/lower|off|deal|discount/i.test(raw)) return raw.toUpperCase();
  }
  const best = bestItemDiscount(restaurant.menu);
  return best > 0 ? `UP TO ${best}% OFF` : 'LOWER PRICES';
}

function HomeRestaurantCardView({
  restaurant,
  staggerIndex,
  cart,
  animate = true,
  onOpen,
  onAdd,
  onCustomize,
  onIncrement,
  onDecrement,
}: HomeRestaurantCardProps) {
  const perfWindow = window as Window & { __cardRenders?: number };
  perfWindow.__cardRenders = (perfWindow.__cardRenders ?? 0) + 1;
  const menu = restaurant.menu
    .filter((item) => Number(item.price) > 0)
    .slice()
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    .slice(0, 6);
  const ratingCount = formatRatingCount(restaurant.ratingCount);
  const delivery = restaurant.time;
  const distance = restaurant.distance;
  const cuisine = restaurant.cuisine;
  const offer = displayOffer(restaurant);
  const freeDelivery = restaurant.freeDeliveryRemaining;
  const minimumOrder = restaurant.minimumOrder;
  const style: CSSProperties | undefined = animate
    ? {
        animation: `cardFadeUp .28s ease forwards ${Math.min(staggerIndex, 6) * 0.045}s`,
        opacity: 0,
      }
    : undefined;

  const openOnKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(restaurant);
    }
  };

  return (
    <div className="u99-card-host" data-home99-restaurant={restaurant.id} style={style}>
      <article className="u99-restaurant-card">
        <div
          className="u99-restaurant-head"
          role="button"
          tabIndex={0}
          aria-label={`Open ${restaurant.name}`}
          data-preload-route={`/restaurant/${restaurant.id}`}
          onClick={() => onOpen(restaurant)}
          onKeyDown={openOnKey}
        >
          <div className="u99-card-copy">
            <div className="u99-discount-line">{offer}</div>
            <h2 className="u99-restaurant-name">
              <span className="u99-name-text">{restaurant.name}</span>
              {restaurant.verified !== false && VERIFIED_BADGE}
            </h2>
            <div className="u99-meta">
              <span className="u99-rating">
                {RATING_BADGE}
                <b>{formatRating(restaurant.rating)}</b>
                {ratingCount && <span className="u99-rating-count">({ratingCount})</span>}
              </span>
              {delivery && (
                <>
                  <span className="u99-sep">•</span>
                  <span className="u99-delivery">
                    {CLOCK_ICON}
                    {delivery}
                  </span>
                </>
              )}
              {distance && (
                <>
                  <span className="u99-sep">•</span>
                  <span className="u99-distance">{distance}</span>
                </>
              )}
              {cuisine && (
                <>
                  <span className="u99-sep">•</span>
                  <span className="u99-cuisine">{cuisine}</span>
                </>
              )}
            </div>
            {freeDelivery != null && (
              <div className="u99-free-row">
                <span className="u99-free-icon" aria-hidden="true">
                  {OFFER_SEAL}
                </span>
                <span className="u99-free-text">
                  {freeDelivery > 0
                    ? `Add ₹${freeDelivery} more to unlock free delivery`
                    : 'Free delivery unlocked'}
                </span>
              </div>
            )}
            {minimumOrder != null && (
              <div className="u99-free-row u99-minimum-row">
                <span className="u99-free-icon" aria-hidden="true">
                  {INFO_ICON}
                </span>
                <span className="u99-free-text">Minimum basket ₹{minimumOrder}</span>
              </div>
            )}
          </div>
        </div>

        <div className="u99-carousel-wrap">
          <div className="u99-carousel" tabIndex={0} aria-label={`${restaurant.name} menu`}>
            {menu.map((menuItem) => {
              const quantity = cart[menuItem.name]?.quantity ?? 0;
              const customisable = isCustomisable(menuItem);
              const customQty = customisable ? customizedQtyFor(cart, menuItem) : 0;
              return (
                <article className="u99-item" data-item-id={menuItem.id} key={menuItem.id}>
                  <div className="u99-item-image">
                    <img
                      className="ew-img-fade is-loaded"
                      src={menuItem.image}
                      alt={`${menuItem.name} from ${restaurant.name}`}
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                    />
                    {menuItem.bestseller && <span className="u99-popular">Popular</span>}
                    <div className="u99-item-action">
                      {customisable ? (
                        <button
                          type="button"
                          className="u99-add u99-add-cust"
                          onClick={() => onCustomize(restaurant, menuItem)}
                          aria-label={`Customise ${menuItem.name}${customQty > 0 ? `, ${customQty} in cart` : ''}`}
                        >
                          +
                          {customQty > 0 && (
                            <span className="u99-cust-qty" aria-hidden="true">
                              {customQty}
                            </span>
                          )}
                        </button>
                      ) : quantity > 0 ? (
                        <div className="u99-stepper">
                          <button type="button" onClick={() => onDecrement(menuItem.name)} aria-label={`Remove one ${menuItem.name}`}>
                            −
                          </button>
                          <span>{quantity}</span>
                          <button type="button" onClick={() => onIncrement(menuItem, restaurant.id)} aria-label={`Add one ${menuItem.name}`}>
                            +
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="u99-add" onClick={() => onAdd(restaurant, menuItem)} aria-label={`Add ${menuItem.name}`}>
                          +
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="u99-item-name">
                    <span className={`u99-dietary${menuItem.isVeg ? '' : ' u99-nonveg'}`} aria-label={menuItem.isVeg ? 'Vegetarian' : 'Non-vegetarian'} />
                    <span>{menuItem.name}</span>
                  </div>
                  <div className="u99-price-row">
                    <strong>₹{menuItem.price}</strong>
                    {menuItem.originalPrice != null && menuItem.originalPrice > menuItem.price && (
                      <span className="u99-old-price">₹{menuItem.originalPrice}</span>
                    )}
                    {(() => {
                      const discount =
                        menuItem.discountPercent ??
                        (menuItem.originalPrice != null && menuItem.originalPrice > menuItem.price
                          ? Math.round((1 - menuItem.price / menuItem.originalPrice) * 100)
                          : null);
                      return discount != null && discount > 0 ? <span className="u99-off">{discount}% OFF</span> : null;
                    })()}
                  </div>
                </article>
              );
            })}
            {menu.length > 0 && (
              <div className="u99-more-tile">
                <button type="button" className="u99-more-box" data-preload-route={`/restaurant/${restaurant.id}`} onClick={() => onOpen(restaurant)} aria-label="View full menu">
                  <span className="u99-more-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="u99-more-text">View full menu</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function sameCartForRestaurant(prev: Cart, next: Cart, resId: number): boolean {
  let prevCount = 0;
  let nextCount = 0;
  for (const line of Object.values(prev)) if (line.resId === resId) prevCount += 1;
  for (const line of Object.values(next)) if (line.resId === resId) nextCount += 1;
  if (prevCount !== nextCount) return false;
  for (const [name, line] of Object.entries(next)) {
    if (line.resId !== resId) continue;
    const other = prev[name];
    if (!other || other.quantity !== line.quantity || other.price !== line.price) return false;
  }
  return true;
}

function sameCardProps(prev: HomeRestaurantCardProps, next: HomeRestaurantCardProps): boolean {
  return (
    prev.restaurant === next.restaurant &&
    prev.staggerIndex === next.staggerIndex &&
    (prev.animate ?? true) === (next.animate ?? true) &&
    prev.onOpen === next.onOpen &&
    prev.onAdd === next.onAdd &&
    prev.onCustomize === next.onCustomize &&
    prev.onIncrement === next.onIncrement &&
    prev.onDecrement === next.onDecrement &&
    sameCartForRestaurant(prev.cart, next.cart, next.restaurant.id)
  );
}

export const HomeRestaurantCard = memo(HomeRestaurantCardView, sameCardProps);
