import type { RefObject } from 'react';
import { formatMoney } from '../../lib/money';
import { rowsFromQuote } from '../../logic/bill';
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

/**
 * `cart-popups.js` builds the sheet from the page's own rows: the quote rows
 * minus the total (the sheet prints that itself), the savings band and the tip
 * block. Same markup, classes and copy.
 */
export function CartBillSheet({ sheetRef, onClose, tip, onTip, onOpenTipSheet }: CartBillSheetProps) {
  const { bill, savings, quote, quoteStatus, quoteBlock, quoteError, retryQuote } = useCartTotals();
  const customTip = tip > 0 && !TIP_PRESETS.includes(tip as (typeof TIP_PRESETS)[number]);
  // A live quote owns the rows; the client estimate stays as the legacy
  // fallback while it is pending or after a failure.
  const quoted = quoteStatus === 'ready' ? rowsFromQuote(quote) : [];
  const live = quoted.filter((row) => row.key !== 'total');
  const rows = live.length ? live : bill.rows.filter((row) => row.key !== 'total');
  const originalTotal = savings > 0 ? Math.round(bill.subtotal + savings) : 0;

  return (
    <Sheet
      ref={sheetRef}
      variant="ctp"
      id="ct-bill-sheet"
      titleId="ct-bill-sheet-title"
      title="Bill summary"
      onClose={onClose}
    >
      {originalTotal > 0 && <div className="ctp-band">{`You saved ₹${savings.toFixed(0)} on this order`}</div>}
      {quoteBlock === 'service' && (
        <div className="ew-qb-blocked" role="alert">
          <span className="ew-qb-blocked-ic" aria-hidden="true">
            !
          </span>
          <div className="ew-qb-blocked-copy">
            <strong>Delivery unavailable</strong>
            <span>{quoteError || 'This delivery is not available right now.'}</span>
          </div>
        </div>
      )}
      {quoteStatus === 'error' && (
        <div className="ew-qb-blocked" role="alert">
          <span className="ew-qb-blocked-ic" aria-hidden="true">
            !
          </span>
          <div className="ew-qb-blocked-copy">
            <strong>We couldn’t price your order</strong>
            <span>{quoteError || 'Please try again.'}</span>
          </div>
          <button type="button" className="ew-qb-confirm" id="ew-quote-retry" onClick={retryQuote}>
            Try again
          </button>
        </div>
      )}
      <div className="ctp-card">
        {rows.length === 0 && (
          <div className="ctp-empty">Your bill will appear here once delivery is calculated.</div>
        )}
        {quoteStatus === 'loading' && <div className="ew-qb-pending">Calculating your bill…</div>}
        {rows.map((row) => {
          const strike = row.key === 'foodSubtotal' && originalTotal > 0 ? `₹${originalTotal}` : '';
          return (
            <div
              key={row.key}
              className={`ctp-row${row.kind === 'discount' ? ' ctp-row--discount' : ''}`}
              data-quote-row={row.key}
            >
              <span className="ctp-row-l">
                {row.label}
                {row.note ? <small>{row.note}</small> : null}
              </span>
              <span className="ctp-row-v">
                {strike ? <s>{strike}</s> : null}
                {row.display || '—'}
              </span>
            </div>
          );
        })}
        <div className="ctp-total">
          <span>To pay</span>
          <strong>{formatMoney(bill.grandTotal || bill.total + bill.tip)}</strong>
        </div>
      </div>
      <div className="ctp-label">Gratitude corner</div>
      <div className="ctp-card ctp-card--pad">
        <div className="ctp-addr-t" style={{ marginBottom: 4 }}>
          Tip your delivery partner
        </div>
        <p className="ctp-tip-sub">100% goes to your delivery partner</p>
        <div className="ctp-chips" role="group" aria-label="Rider tip">
          <button
            type="button"
            aria-pressed={tip === 0}
            className={`ctp-chip${tip === 0 ? ' is-on' : ''}`}
            data-ctp-tip="0"
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
              data-ctp-tip={amount}
              onClick={() => onTip(amount)}
            >
              ₹{amount}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={customTip}
            className={`ctp-chip${customTip ? ' is-on' : ''}`}
            data-ctp-tip="custom"
            onClick={onOpenTipSheet}
          >
            {customTip ? `₹${tip} · Edit` : 'Other'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
