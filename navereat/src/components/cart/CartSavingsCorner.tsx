import { Icon } from '../Icon';
import { useAppStore } from '../../store/appStore';
import { chevron } from './cartIcons';
import { useCartTotals } from './cartTotals';

export function CartSavingsCorner({ onOpenCoupon }: { onOpenCoupon: () => void }) {
  const coupon = useAppStore((state) => state.coupon);
  const { savings, freeDelivery, bill } = useCartTotals();

  return (
    <section aria-labelledby="ct-sav-title" className="ct-card ct-savings" id="ct-payment-group">
      <h2 className="ct-sec-title" id="ct-sav-title">
        Savings corner
      </h2>
      <button className="ct-sav-row ct-sav-coupon" id="coupon-card" type="button" onClick={onOpenCoupon}>
        <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--offer">
          <Icon name="solid:tag" size={22} />
        </span>
        <span className="ct-sav-copy">
          <span className="ct-sav-title">{coupon ? coupon.code : 'Apply coupon code'}</span>
          {coupon ? (
            <span className="ct-sav-sub" id="coupon-card-sub">
              {coupon.title}
            </span>
          ) : savings === 0 ? (
            <span className="ct-sav-sub" id="coupon-card-sub">
              Save more on this order
            </span>
          ) : null}
        </span>
        {(coupon || savings > 0) && (
          <span className="ct-group-flag ct-sav-flag" id="coupon-applied-flag">
            <Icon name="solid:check" size={13} /> Applied
          </span>
        )}
        {chevron}
      </button>
      {savings > 0 && (
        <div className="ct-sav-row ct-sav-static" id="ct-sav-items">
          <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--pct">
            <Icon name="solid:percent" size={22} />
          </span>
          <span className="ct-sav-copy">
            <span className="ct-sav-title">₹{savings} saved on item discounts</span>
          </span>
          <span className="ct-sav-flag is-static">
            <Icon name="solid:check" size={13} /> Applied
          </span>
        </div>
      )}
      {freeDelivery && (
        <div className="ct-sav-row ct-sav-static" id="ct-sav-delivery">
          <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--ride">
            <Icon name="solid:motorcycle" size={22} />
          </span>
          <span className="ct-sav-copy">
            <span className="ct-sav-title" id="ct-sav-delivery-text">
              Free delivery applied
            </span>
          </span>
          <span className="ct-sav-flag is-static">
            <Icon name="solid:check" size={13} /> Applied
          </span>
        </div>
      )}
      {bill.offerDiscount > 0 && (
        <div className="ct-sav-row ct-sav-static" id="ct-sav-discount">
          <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--pct">
            <Icon name="solid:percent" size={22} />
          </span>
          <span className="ct-sav-copy">
            <span className="ct-sav-title" id="ct-sav-discount-text">
              ₹{bill.offerDiscount} extra off
            </span>
          </span>
          <span className="ct-sav-flag is-static">
            <Icon name="solid:check" size={13} /> Applied
          </span>
        </div>
      )}
    </section>
  );
}
