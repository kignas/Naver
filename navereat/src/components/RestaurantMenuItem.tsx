import { memo } from 'react';
import type { MenuItem } from '../data/demo';
import { isCustomisable } from '../lib/customization';

export interface RestaurantMenuItemProps {
  menuItem: MenuItem;
  resId: number;
  qty: number;
  customQty: number;
  ratingKnown: boolean;
  rating: number;
  itemRating: string;
  animationDelay: string;
  onAdd: (item: MenuItem, resId: number) => void;
  onDecrement: (name: string) => void;
  onRemoveCustom: (item: MenuItem) => void;
  onCustomize: (item: MenuItem, resId: number) => void;
}

function RestaurantMenuItemView({
  menuItem,
  resId,
  qty,
  customQty,
  ratingKnown,
  rating,
  itemRating,
  animationDelay,
  onAdd,
  onDecrement,
  onRemoveCustom,
  onCustomize,
}: RestaurantMenuItemProps) {
  const customisable = isCustomisable(menuItem);
  const originalPrice =
    menuItem.originalPrice && menuItem.originalPrice > menuItem.price ? menuItem.originalPrice : null;
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
        style={{ animationDelay }}
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
                    onClick={() => onRemoveCustom(menuItem)}
                    aria-label={`Remove one ${menuItem.name} from cart`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="nb-add-btn nb-add-btn--cust has-cart-qty"
                    data-menu-item-id={menuItem.id}
                    aria-label={`Customise ${menuItem.name}, ${customQty} in cart`}
                    onClick={() => onCustomize(menuItem, resId)}
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
                  onClick={() => onCustomize(menuItem, resId)}
                >
                  ADD <span className="nb-add-plus" aria-hidden="true">+</span>
                </button>
              )
            ) : qty > 0 ? (
              <div className="nb-qty" role="group" aria-label="Quantity">
                <button
                  type="button"
                  className="nb-qty-btn"
                  onClick={() => onDecrement(menuItem.name)}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="nb-qty-val">{qty}</span>
                <button
                  type="button"
                  className="nb-qty-btn"
                  onClick={() => onAdd(menuItem, resId)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="nb-add-btn"
                onClick={() => onAdd(menuItem, resId)}
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
}

export const RestaurantMenuItem = memo(RestaurantMenuItemView);
