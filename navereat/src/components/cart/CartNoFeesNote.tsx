import { useCartTotals } from './cartTotals';

/**
 * The static "₹0 Packaging Fee · ₹0 Platform Fee" strip is only true while no
 * extra fee applies; `cart-checkout-upgrades.js` hides it as soon as one does.
 */
export function CartNoFeesNote() {
  const { bill } = useCartTotals();
  const anyFee =
    bill.packagingFee > 0 || bill.platformFee > 0 || bill.smallOrderFee > 0 || bill.tax > 0;
  if (anyFee) return null;

  return (
    <div className="ct-fees" role="note">
      <svg aria-hidden="true" className="ct-fees-ic" fill="none" height="14" viewBox="0 0 24 24" width="14">
        <path
          d="M19.5 4.5c.6 6.9-2.8 11.5-8.4 11.5H8.6C8.2 10.3 12.6 5.7 19.5 4.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M5.2 19.5c.3-3.3 1.4-6 3.4-8.1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
      <span className="ct-fees-copy">
        <strong>₹0</strong> Packaging Fee
        <span aria-hidden="true" className="ct-fees-dot" />
        <strong>₹0</strong> Platform Fee
      </span>
    </div>
  );
}
