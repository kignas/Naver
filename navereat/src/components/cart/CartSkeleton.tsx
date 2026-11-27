/**
 * Cart placeholder shown while the page slides and until the reveal gate opens.
 * It mirrors the real cart's top-level cards so the swap does not move the page.
 */
export function CartSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="rv-cart-skeleton" aria-hidden="true">
      <div className="ct-card ct-item-card rv-cart-card">
        <div className="ct-restaurant-head">
          <div className="ct-restaurant-copy">
            <span className="rv-sk" style={{ height: 16, width: '52%' }} />
            <span className="rv-sk" style={{ height: 12, width: '34%', marginTop: 6 }} />
          </div>
        </div>
        {Array.from({ length: Math.max(1, rows) }, (_, row) => (
          <div className="ct-row rv-cart-row" key={row}>
            <div className="ct-info">
              <span className="rv-sk" style={{ height: 15, width: '60%' }} />
              <span className="rv-sk" style={{ height: 12, width: '28%', marginTop: 8 }} />
              <span className="rv-sk" style={{ height: 14, width: 52, marginTop: 10 }} />
            </div>
            <div className="ct-right rv-cart-right">
              <span className="rv-sk" style={{ height: 16, width: 44 }} />
              <span className="rv-sk rv-cart-stepper" />
            </div>
          </div>
        ))}
      </div>
      <div className="rv-sk rv-cart-strip" />
      <div className="ct-card rv-cart-card">
        <span className="rv-sk" style={{ height: 18, width: '40%' }} />
        <div className="rv-cart-upsell">
          <span className="rv-sk rv-cart-thumb" />
          <div className="rv-cart-upsell-copy">
            <span className="rv-sk" style={{ height: 14, width: '78%' }} />
            <span className="rv-sk" style={{ height: 13, width: '38%', marginTop: 8 }} />
          </div>
        </div>
      </div>
      <div className="ct-oi-card rv-cart-card">
        <span className="rv-sk" style={{ height: 18, width: '46%' }} />
        {[0, 1, 2, 3].map((line) => (
          <span className="rv-sk rv-cart-line" key={line} style={{ width: `${82 - line * 10}%` }} />
        ))}
      </div>
      <div className="ct-oi-policy rv-cart-policy">
        <span className="rv-sk" style={{ height: 12, width: '32%' }} />
        <span className="rv-sk" style={{ height: 11, width: '92%', marginTop: 8 }} />
      </div>
      <div className="ct-footer rv-cart-footer">
        <div className="rv-cart-paybar">
          <span className="rv-sk" style={{ height: 22, width: 86 }} />
          <span className="rv-sk rv-cart-cta" />
        </div>
      </div>
    </div>
  );
}
