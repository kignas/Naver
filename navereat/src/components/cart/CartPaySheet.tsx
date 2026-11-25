import type { RefObject } from 'react';
import { Icon } from '../Icon';
import { Sheet, type SheetHandle } from '../Sheet';

type Payment = 'upi' | 'cod';

interface CartPaySheetProps {
  sheetRef: RefObject<SheetHandle>;
  onClose: () => void;
  payment: Payment;
  onPayment: (value: Payment) => void;
  onPlace: () => void;
}

/* Titles, notes and glyphs match cart.html + js/cart-checkout-upgrades.js. */
const OPTIONS = [
  {
    id: 'upi' as const,
    title: 'UPI / Online Payment',
    sub: 'Instant & Contactless',
    icon: 'solid:mobile-screen-button' as const,
  },
  {
    id: 'cod' as const,
    title: 'Cash on Delivery (COD)',
    sub: 'Pay Cash or UPI at Doorstep',
    icon: 'solid:hand-holding-dollar' as const,
  },
];

export function CartPaySheet({ sheetRef, onClose, payment, onPayment, onPlace }: CartPaySheetProps) {
  return (
    <Sheet
      ref={sheetRef}
      id="ct-pay-sheet"
      titleId="pay-sheet-title"
      title="Select payment method"
      onClose={onClose}
    >
      <div className="ct-pay-opts" id="ct-pay-sheet-opts" role="radiogroup" aria-label="Payment method">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={payment === option.id}
            className={`ct-pay-opt${payment === option.id ? ' is-selected' : ''}`}
            data-ct-pick={option.id}
            onClick={() => onPayment(option.id)}
          >
            <span className="ct-pay-ic" aria-hidden="true">
              <Icon name={option.icon} size={18} />
            </span>
            <span className="ct-pay-copy">
              <span className="ct-pay-title">{option.title}</span>
              <span className="ct-pay-sub">{option.sub}</span>
            </span>
            <span className="ct-pay-radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div id="ct-pay-confirm">
        <button id="ct-pay-confirm-btn" className="ct-btn ct-btn-primary" type="button" onClick={onPlace}>
          {payment === 'cod' ? 'Place Order (Pay on delivery)' : 'Pay & Place Order'}
        </button>
      </div>
    </Sheet>
  );
}
