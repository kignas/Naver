import type { RefObject } from 'react';
import { Icon } from '../Icon';
import { formatMoney } from '../../lib/money';
import { Sheet, type SheetHandle } from '../Sheet';
import { useCartTotals } from './cartTotals';

type Payment = 'upi' | 'cod';

interface CartPaySheetProps {
  sheetRef: RefObject<SheetHandle>;
  onClose: () => void;
  tip: number;
  payment: Payment;
  onPayment: (value: Payment) => void;
  onPlace: () => void;
}

const OPTIONS = [
  { id: 'upi' as const, title: 'UPI / Online Payment', sub: 'GPay, PhonePe, Paytm and more', icon: 'solid:wallet' as const },
  { id: 'cod' as const, title: 'Cash on Delivery (COD)', sub: 'Pay when your order arrives', icon: 'solid:money-bill-transfer' as const },
];

export function CartPaySheet({ sheetRef, onClose, tip, payment, onPayment, onPlace }: CartPaySheetProps) {
  const { bill } = useCartTotals();
  const payTotal = bill.total + tip;

  return (
    <Sheet ref={sheetRef} title="Select payment method" onClose={onClose}>
      <div className="ct-pay-opts" role="radiogroup" aria-label="Payment method">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={payment === option.id}
            className={`ct-pay-opt${payment === option.id ? ' is-selected' : ''}`}
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
      <button
        className="ct-btn ct-btn-primary navereat-place-order"
        id="btn-checkout"
        data-preload-route="/track/demo"
        type="button"
        onClick={onPlace}
      >
        Place Order · {formatMoney(payTotal)}
      </button>
    </Sheet>
  );
}
