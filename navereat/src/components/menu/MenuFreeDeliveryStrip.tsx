import { memo } from 'react';
import { useAppStore } from '../../store/appStore';

/**
 * The only part of the restaurant header that depends on the cart. Subscribing
 * here keeps a `+` tap from re-rendering the menu page around it.
 */
export const MenuFreeDeliveryStrip = memo(function MenuFreeDeliveryStrip({
  restaurantId,
  freeAbove,
}: {
  restaurantId: number;
  freeAbove: number;
}) {
  const subtotal = useAppStore((state) =>
    Object.values(state.cart)
      .filter((line) => line.resId === restaurantId)
      .reduce((sum, line) => sum + line.price * line.quantity, 0),
  );
  const unlocked = subtotal >= freeAbove;
  const amount = Math.max(0, freeAbove - subtotal);

  return (
    <div className="delivery-strip">
      <div className="delivery-banner-line" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="delivery-copy">
        <span className="del-chip" id="res-free-delivery">
          <span className={unlocked ? 'is-free' : ''}>
            {unlocked ? (
              'Free delivery unlocked'
            ) : (
              <>
                Add <strong>₹{amount}</strong> more to unlock free delivery
              </>
            )}
          </span>
        </span>
      </div>
      <div className="delivery-rider" aria-hidden="true">
        <svg
          id="delivery-rider-fallback"
          role="presentation"
          width="100"
          height="54"
          viewBox="0 0 110 58"
        >
          <g fill="none" stroke="none">
            <circle cx="80" cy="43" fill="#222936" r="9" />
            <circle cx="32" cy="43" fill="#222936" r="9" />
            <path d="M31 42h26l8-17h15l8 9H70l-8 8H43" style={{ fill: 'var(--hd-primary,#E9546B)' }} />
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
  );
});
