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
  const { bill, totalSavings, groups, paymentOptions } = useCartTotals();
  const payTotal = bill.total + tip;
  const units = groups.reduce((count, group) => count + group.units, 0);
  const plural = units === 1 ? 'item' : 'items';

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
        <button
          className={unavailable ? 'ct-cta locked' : 'ct-cta'}
          id="btn-checkout"
          type="button"
          aria-disabled={unavailable || paymentOptions.block ? 'true' : 'false'}
          onClick={unavailable || paymentOptions.block || !paymentOptions.choice ? onPlace : onProceed}
        >
          <span className="ct-cta-text" id="checkout-label">
            {unavailable ? (
              <>
                Delivery unavailable
                <span className="ct-cta-sub">Change your address to continue</span>
              </>
            ) : paymentOptions.block ? (
              <>
                {paymentOptions.block.label}
                <span className="ct-cta-sub">{paymentOptions.block.sub}</span>
              </>
            ) : (
              <>
                {paymentOptions.ctaLabel}{' '}
                <svg className="ct-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12h13m-5-5.5 5.5 5.5-5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="ct-cta-sub">
                  {units} {plural}
                </span>
              </>
            )}
          </span>
        </button>
      </div>
      <div className="ct-pay-note">
        <Icon name="solid:lock" size={12} />
        <span id="ct-pay-note-text">{paymentOptions.payNote}</span>
      </div>
    </div>
  );
}
