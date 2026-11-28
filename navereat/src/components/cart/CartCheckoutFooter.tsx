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

/**
 * `#checkout-footer`: the payable amount + "View detailed bill" on the left, the
 * CTA on the right, the pay note underneath. Label and sub-label come from
 * `updateCheckoutCta()` (see `logic/checkoutCta`); a locked CTA still runs
 * `placeOrder()`, which is where the legacy gate toasts live.
 */
export function CartCheckoutFooter({ tip, unavailable, onOpenBill, onProceed, onPlace }: CartCheckoutFooterProps) {
  const { bill, totalSavings, paymentOptions, cta } = useCartTotals();
  const payTotal = bill.total + tip;
  const locked = cta.locked || Boolean(paymentOptions.block);

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
          className={locked ? 'ct-cta locked' : 'ct-cta'}
          id="btn-checkout"
          type="button"
          aria-disabled={locked ? 'true' : 'false'}
          onClick={locked || !paymentOptions.choice ? onPlace : onProceed}
        >
          <span className="ct-cta-text" id="checkout-label">
            {cta.label} {cta.arrow && <CtaArrow />}
            <span className="ct-cta-sub">{cta.sub}</span>
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

function CtaArrow() {
  return (
    <svg className="ct-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13m-5-5.5 5.5 5.5-5.5 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
