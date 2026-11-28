import type { RefObject } from 'react';
import { formatMoney } from '../../lib/money';
import { Sheet, type SheetHandle } from '../Sheet';
import { TIP_PRESETS } from './cartConstants';
import { useCartTotals } from './cartTotals';

interface CartBillSheetProps {
  sheetRef: RefObject<SheetHandle>;
  onClose: () => void;
  tip: number;
  onTip: (value: number) => void;
  onOpenTipSheet: () => void;
}

export function CartBillSheet({ sheetRef, onClose, tip, onTip, onOpenTipSheet }: CartBillSheetProps) {
  const { bill, savings } = useCartTotals();
  const payTotal = bill.total + tip;
  const customTip = tip > 0 && !TIP_PRESETS.includes(tip as (typeof TIP_PRESETS)[number]);
  const km = Number(bill.distanceKm);
  const kmLabel = Number.isFinite(km) && km > 0 ? ` | ${km.toFixed(1)} kms` : '';

  return (
    <Sheet ref={sheetRef} title="Bill summary" onClose={onClose}>
      <div className="ct-bill" id="ct-bill">
        <div className="ct-bill-rows">
          <div className="ct-bill-row">
            <span className="ct-bill-label">Item total</span>
            <span className="ct-bill-val ct-bill-price-pair">
              {savings > 0 && <s>₹{bill.subtotal + savings}</s>}
              <span className="ct-now">{formatMoney(bill.subtotal)}</span>
            </span>
          </div>
          <div className="ct-bill-sep" />
          <div className="ct-bill-row">
            <span className="ct-bill-label is-dashed">
              {bill.deliverySubsidy > 0 ? 'Delivery (free)' : 'Delivery fee'}
              {kmLabel}
            </span>
            <span className={bill.deliveryFee > 0 ? 'ct-bill-val' : 'ct-bill-val is-free'}>
              {bill.deliveryFee > 0 ? (
                formatMoney(bill.deliveryFee)
              ) : bill.baseDeliveryFee > 0 ? (
                <>
                  <s>{formatMoney(bill.baseDeliveryFee)}</s> FREE
                </>
              ) : (
                'FREE'
              )}
            </span>
          </div>
          <div className="ct-bill-row">
            <span className="ct-bill-label">Platform fee</span>
            <span className="ct-bill-val is-free">{formatMoney(bill.platformFee)}</span>
          </div>
          <div className="ct-bill-row">
            <span className="ct-bill-label">Packaging fee</span>
            <span className="ct-bill-val is-free">{formatMoney(bill.packagingFee)}</span>
          </div>
          {bill.tax > 0 && (
            <div className="ct-bill-row">
              <span className="ct-bill-label is-dashed">Government Taxes</span>
              <span className="ct-bill-val">{formatMoney(bill.tax)}</span>
            </div>
          )}
          {bill.codFee > 0 && (
            <div className="ct-bill-row">
              <span className="ct-bill-label">COD handling fee</span>
              <span className="ct-bill-val">{formatMoney(bill.codFee)}</span>
            </div>
          )}
          {bill.smallOrderFee > 0 && (
            <div className="ct-bill-row">
              <span className="ct-bill-label">Small order fee</span>
              <span className="ct-bill-val">{formatMoney(bill.smallOrderFee)}</span>
            </div>
          )}
          {bill.discount > 0 && (
            <div className="ct-bill-row">
              <span className="ct-bill-label">Coupon discount</span>
              <span className="ct-bill-val is-save">-{formatMoney(bill.discount)}</span>
            </div>
          )}
          {bill.offerDiscount > 0 && (
            <div className="ct-bill-row">
              <span className="ct-bill-label">Extra discount for you</span>
              <span className="ct-bill-val is-save">-{formatMoney(bill.offerDiscount)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="ct-bill-row">
              <span className="ct-bill-label">Delivery partner tip</span>
              <span className="ct-bill-val">{formatMoney(tip)}</span>
            </div>
          )}
        </div>
        <div className="ct-bill-band">THAT'S IT. No unnecessary fees. Ever!</div>
        <div className="ctp-label">Gratitude corner</div>
        <div className="ctp-card ctp-card--pad">
          <div className="ctp-chips">
            <button
              type="button"
              aria-pressed={tip === 0}
              className={`ctp-chip${tip === 0 ? ' is-on' : ''}`}
              onClick={() => onTip(0)}
            >
              No tip
            </button>
            {TIP_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                aria-pressed={tip === amount}
                className={`ctp-chip${tip === amount ? ' is-on' : ''}`}
                onClick={() => onTip(amount)}
              >
                ₹{amount}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={customTip}
              className={`ctp-chip${customTip ? ' is-on' : ''}`}
              onClick={onOpenTipSheet}
            >
              {customTip ? `₹${tip} · Edit` : 'Other'}
            </button>
          </div>
        </div>
        <div className="ct-bill-total">
          <span className="ct-total-label">To Pay</span>
          <span className="ct-total-val">{formatMoney(payTotal)}</span>
        </div>
      </div>
    </Sheet>
  );
}
