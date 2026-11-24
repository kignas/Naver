import { Icon } from '../Icon';
import { formatMoney } from '../../lib/money';
import { chevron } from './cartIcons';
import { useCartTotals } from './cartTotals';

interface CartBillRowProps {
  tip: number;
  unavailable: boolean;
  onOpenBill: () => void;
}

/** The only row of the order-info card that moves when the cart changes. */
export function CartBillRow({ tip, unavailable, onOpenBill }: CartBillRowProps) {
  const { bill, subtotal, savings, totalSavings } = useCartTotals();
  const payTotal = bill.total + tip;

  return (
    <button className="ct-oi-row ct-oi-row--link ct-oi-row--bill" type="button" onClick={onOpenBill}>
      <span aria-hidden="true" className="ct-oi-ic">
        <Icon name="solid:receipt" size={22} />
      </span>
      <div className="ct-oi-copy">
        <span className="ct-oi-line">
          Total Bill{' '}
          {unavailable ? (
            <>
              <s>₹{subtotal + savings}</s> <b>—</b>
            </>
          ) : (
            <b>{formatMoney(payTotal)}</b>
          )}
          {totalSavings > 0 && <span className="ct-oi-saved">You saved ₹{totalSavings}</span>}
        </span>
        <span className="ct-oi-sub">Incl. taxes and charges</span>
      </div>
      {chevron}
    </button>
  );
}
