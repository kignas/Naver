import { useRef, type RefObject } from 'react';
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

/* The sheet's confirm button lands where the cart's pay bar was, so a double
   tap on "Proceed to Pay" would otherwise place the order before the customer
   ever sees the payment options. Touch taps in the first moments after the
   sheet mounts are swallowed, the way native bottom sheets do it. Mouse and
   keyboard activation stay immediate (that is a deliberate click, not a
   finger still travelling from the previous screen). */
const TAP_THROUGH_GUARD_MS = 350;

export function CartPaySheet({ sheetRef, onClose, payment, onPayment, onPlace }: CartPaySheetProps) {
  const mountedAt = useRef(performance.now());
  const pointerType = useRef('mouse');
  const confirm = () => {
    const touch = pointerType.current === 'touch';
    if (touch && performance.now() - mountedAt.current < TAP_THROUGH_GUARD_MS) return;
    onPlace();
  };
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
        <button
          id="ct-pay-confirm-btn"
          className="ct-btn ct-btn-primary"
          type="button"
          onPointerDown={(event) => {
            pointerType.current = event.pointerType || 'mouse';
          }}
          onClick={confirm}
        >
          {payment === 'cod' ? 'Place Order (Pay on delivery)' : 'Pay & Place Order'}
        </button>
      </div>
    </Sheet>
  );
}
