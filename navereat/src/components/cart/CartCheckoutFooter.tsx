import { Icon } from '../Icon';
import { formatMoney } from '../../lib/money';
import { useCartTotals } from './cartTotals';

interface CartCheckoutFooterProps {
  tip: number;
  unavailable: boolean;
  onOpenBill: () => void;
  onProceed: () => void;
  onPlace: () => void;
}

export function CartCheckoutFooter({ tip, unavailable, onOpenBill, onProceed, onPlace }: CartCheckoutFooterProps) {
  const { bill, totalSavings } = useCartTotals();
  const payTotal = bill.total + tip;

  return (
    <div className="ct-footer" id="checkout-footer">
      {totalSavings > 0 && (
        <button className="ct-footer-save ct-save-strip show" id="ct-footer-save" type="button" onClick={onOpenBill}>
          <span className="ct-save-text" id="ct-footer-save-text">
            ₹{totalSavings} saved on this order with Navereat!
          </span>
        </button>
      )}
      <div className="ct-paybar">
        <button className="ct-paybar-left tap" id="ct-view-bill" type="button" onClick={onOpenBill}>
          <span className="ct-paybar-amt">{unavailable ? '—' : formatMoney(payTotal)}</span>
          <span className="ct-paybar-link">View detailed bill</span>
        </button>
        {unavailable ? (
          <button className="ct-cta locked" type="button" aria-disabled="true" onClick={onPlace}>
            <span className="ct-cta-text">
              Delivery unavailable
              <span className="ct-cta-sub">Change your address to continue</span>
            </span>
          </button>
        ) : (
          <button className="ct-cta" type="button" onClick={onProceed}>
            <span className="ct-cta-text">Proceed to Pay</span>
          </button>
        )}
      </div>
      <div className="ct-pay-note">
        <Icon name="solid:lock" size={12} />
        <span>Secure UPI payment · GPay, PhonePe &amp; more</span>
      </div>
    </div>
  );
}
