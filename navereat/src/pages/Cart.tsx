import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet, type SheetHandle } from '../components/Sheet';
import { coupons, DEMO_ADDRESS, findRestaurant, type Coupon } from '../data/demo';
import { billFor, cartRestaurantId, type CartLine } from '../lib/cart';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import cartBundleCss from '../styles/original/cart.bundle.css?raw';
import '../styles/pages/cart.css';

type Payment = 'upi' | 'cod';
type SheetName = 'coupon' | 'bill' | 'pay' | 'note' | null;

interface Group {
  resId: number;
  name: string;
  lines: Array<{ name: string; line: CartLine }>;
  units: number;
  subtotal: number;
  anyMedia: boolean;
}

const addressText = DEMO_ADDRESS.includes('·')
  ? DEMO_ADDRESS.split('·').slice(1).join('·').trim()
  : DEMO_ADDRESS;

const chevron = (
  <svg aria-hidden="true" className="ct-oi-chev" fill="none" height="18" viewBox="0 0 24 24" width="18">
    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
  </svg>
);

const clockIcon = (
  <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
    <path d="M9.5 3.5h5M12 3.5V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    <circle cx="12" cy="13.2" r="7.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 9.6v3.8l2.4 1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
  </svg>
);

const plateIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7.5 3.5v6.2a2.2 2.2 0 0 0 4.4 0V3.5M9.7 9.7V20.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.8 3.5c-1.2 1.4-1.8 3.2-1.8 5.2 0 1.6.6 2.6 1.8 2.9V20.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const trashIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5.5 7h13M10 4.8h4M9.4 10.5v6M14.6 10.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 7h10l-.7 11.1A1.6 1.6 0 0 1 14.7 19.6H9.3a1.6 1.6 0 0 1-1.6-1.5L7 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

function VegMark({ value }: { value?: boolean }) {
  if (value === undefined) return null;
  return (
    <span className={`nb-veg-mark ${value ? 'veg' : 'nonveg'}`} title={value ? 'Veg' : 'Non-veg'}>
      <span />
    </span>
  );
}

export function Cart() {
  const nav = useAppNav();
  const cart = useAppStore((s) => s.cart);
  const coupon = useAppStore((s) => s.coupon);
  const user = useAppStore((s) => s.user);
  const setQty = useAppStore((s) => s.setQty);
  const applyCoupon = useAppStore((s) => s.applyCoupon);
  const removeCoupon = useAppStore((s) => s.removeCoupon);
  const placeOrder = useAppStore((s) => s.placeOrder);

  const [sheet, setSheet] = useState<SheetName>(null);
  const sheetRef = useRef<SheetHandle>(null);
  const closeSheet = () => sheetRef.current?.close();
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<Payment>('upi');
  const [cutlery, setCutlery] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.navereatCart = 'true';
    style.textContent = cartBundleCss;
    document.head.appendChild(style);
    document.body.classList.add('ct-page');
    document.body.classList.remove('ct-loading-cart', 'ct-loading-delivery', 'ct-location-modal-open');
    return () => {
      style.remove();
      document.body.classList.remove('ct-page');
    };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<number, Group>();
    Object.entries(cart).forEach(([name, line]) => {
      const group = map.get(line.resId) ?? {
        resId: line.resId,
        name: line.resName ?? findRestaurant(line.resId)?.name ?? 'Restaurant',
        lines: [],
        units: 0,
        subtotal: 0,
        anyMedia: false,
      };
      group.lines.push({ name, line });
      group.units += line.quantity;
      group.subtotal += line.price * line.quantity;
      group.anyMedia = group.anyMedia || Boolean(line.image);
      map.set(line.resId, group);
    });
    return [...map.values()];
  }, [cart]);

  const restaurant = findRestaurant(cartRestaurantId(cart) ?? undefined);
  const bill = billFor(cart, coupon);
  const lines = Object.values(cart);
  const savings = lines.reduce(
    (sum, line) => sum + Math.max(0, (line.originalPrice ?? line.price) - line.price) * line.quantity,
    0,
  );
  const freeAbove = restaurant?.freeDeliveryAbove ?? 399;
  const freeDelivery = (groups[0]?.subtotal ?? 0) >= freeAbove;
  const restaurantName = groups.length > 1 ? `${groups.length} restaurants` : groups[0]?.name ?? restaurant?.name ?? 'Your cart';
  const eta = restaurant ? `${restaurant.deliveryMin}–${restaurant.deliveryMax} mins` : '30–40 mins';
  const displayName = user?.name ?? 'Demo Foodie';
  const phone = user?.phone ?? '+91 98765 43210';

  const handleApply = (value: string) => {
    const result = applyCoupon(value);
    toast(result.message, result.ok ? 'success' : 'error');
    if (result.ok) {
      setCode('');
      closeSheet();
    }
  };

  const handlePlace = () => {
    const order = placeOrder(payment === 'cod' ? 'Cash on Delivery' : 'UPI');
    if (!order) {
      toast('Your cart is empty', 'error');
      return;
    }
    closeSheet();
    toast(`Order ${order.id} placed`, 'success');
    nav.push('/success');
  };

  if (lines.length === 0) {
    return (
      <div className="page cart-page">
        <div className="ct-empty" id="empty-cart">
          <svg aria-hidden="true" className="ct-empty-art" fill="none" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 32h52l-5 44a8 8 0 0 1-8 7H35a8 8 0 0 1-8-7L22 32Z" fill="#EFF2F4" stroke="#CBD3DA" strokeLinejoin="round" strokeWidth="3" />
            <path d="M36 32v-6a12 12 0 0 1 24 0v6" stroke="var(--hd-primary,#0b7a2a)" strokeLinecap="round" strokeWidth="3.5" />
            <circle cx="39" cy="55" fill="#CBD3DA" r="3" />
            <circle cx="57" cy="55" fill="#CBD3DA" r="3" />
            <path d="M39 68c4.5-4 13.5-4 18 0" stroke="#CBD3DA" strokeLinecap="round" strokeWidth="3" />
          </svg>
          <div className="ct-empty-title">Your cart is empty</div>
          <div className="ct-empty-sub">Pick a restaurant and add a few dishes — your order will show up here.</div>
          <button className="ct-empty-btn tap" type="button" onClick={() => nav.tab('/')}>
            Browse restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div id="cart-has-items">
        <div className="ct-delivery-head" id="delivery-eta-card">
          <button aria-label="Go back" className="ct-dh-back tap" type="button" onClick={nav.back}>
            <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
              <path d="M15 5.5 8.5 12l6.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
            </svg>
          </button>
          <div className="ct-dh-main">
            <span className="ct-dh-copy">
              <span className="ct-dh-restaurant" id="ct-dh-restaurant">
                {restaurantName}
              </span>
            </span>
          </div>
        </div>

        <div className="ct-fees" role="note">
          <svg aria-hidden="true" className="ct-fees-ic" fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path d="M19.5 4.5c.6 6.9-2.8 11.5-8.4 11.5H8.6C8.2 10.3 12.6 5.7 19.5 4.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
            <path d="M5.2 19.5c.3-3.3 1.4-6 3.4-8.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          </svg>
          <span className="ct-fees-copy">
            <strong>₹0</strong> Packaging Fee
            <span aria-hidden="true" className="ct-fees-dot" />
            <strong>₹0</strong> Platform Fee
          </span>
        </div>

        <div className="ct-card ct-item-card">
          <div aria-live="polite" id="cart-items-list">
            {groups.map((group, groupIndex) => (
              <section className="ct-restaurant-group" data-restaurant-id={group.resId} key={group.resId}>
                <div className="ct-restaurant-head">
                  <div className="ct-restaurant-copy">
                    <div className="ct-restaurant-name">{group.name}</div>
                    <div className="ct-restaurant-meta">
                      {group.units} {group.units === 1 ? 'item' : 'items'} · ₹{group.subtotal}
                    </div>
                  </div>
                </div>
                <div className="ct-restaurant-items">
                  {group.lines.map(({ name, line }) => {
                    const original = Number(line.originalPrice ?? 0);
                    const hasDiscount = original > line.price;
                    const discountPct = hasDiscount ? Math.round(((original - line.price) / original) * 100) : 0;
                    const itemTotal = line.quantity * line.price;
                    const itemSavings = hasDiscount ? line.quantity * (original - line.price) : 0;
                    const last = line.quantity <= 1;
                    return (
                      <div className={`ct-row${group.anyMedia ? ' has-media' : ''}`} data-name={name} key={name}>
                        {group.anyMedia && (
                          <div className="ct-media">
                            <div className="ct-media-fallback">{plateIcon}</div>
                            {line.image && <img src={line.image} alt="" loading="lazy" decoding="async" />}
                          </div>
                        )}
                        <div className="ct-info">
                          <div className="ct-name-row">
                            <VegMark value={line.isVeg} />
                            <span className="ct-name">{name}</span>
                          </div>
                          <div className="ct-price-line">
                            <span className="ct-unit-price ct-num">₹{line.price}</span>
                            {hasDiscount && (
                              <>
                                <span className="ct-was-price ct-num">₹{original}</span>
                                <span className="ct-off-badge">{discountPct}% OFF</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="ct-right">
                          <div>
                            {hasDiscount && <div className="ct-item-was ct-num">₹{line.quantity * original}</div>}
                            <div className="ct-item-total ct-num">₹{itemTotal}</div>
                            {hasDiscount && <div className="ct-item-save ct-num">Save ₹{itemSavings.toFixed(0)}</div>}
                          </div>
                          <div className={`ct-stepper${last ? ' is-last' : ''}`} role="group" aria-label={`Quantity for ${name}`}>
                            <button
                              type="button"
                              className="ct-step-down"
                              aria-label={last ? `Remove ${name}` : 'Decrease quantity'}
                              onClick={() => setQty(name, line.quantity - 1)}
                            >
                              {last ? trashIcon : <span className="ct-step-glyph" aria-hidden="true">−</span>}
                            </button>
                            <span className="ct-qty">{line.quantity}</span>
                            <button
                              type="button"
                              className="ct-step-up"
                              aria-label="Increase quantity"
                              onClick={() => setQty(name, line.quantity + 1)}
                            >
                              <span className="ct-step-glyph" aria-hidden="true">+</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="ct-item-actions ct-group-actions">
                  <button className="ct-pill-btn tap" type="button" onClick={() => nav.push(`/restaurant/${group.resId}`)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                    Add Items
                  </button>
                  <button className="ct-pill-btn tap" type="button" onClick={() => setSheet('note')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 19h14M7 15l9-9 2 2-9 9H7v-2z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="ct-note-btn-text">{note ? 'Request added' : 'Cooking requests'}</span>
                  </button>
                  {groupIndex === 0 && (
                    <label className="ct-pill-btn ct-cutlery-chip tap">
                      <input type="checkbox" checked={cutlery} onChange={(event) => setCutlery(event.target.checked)} />
                      <span className="ct-cutlery-box" aria-hidden="true" />
                      <span>Cutlery Needed</span>
                    </label>
                  )}
                </div>
                {note && <div className="ct-restaurant-note-preview">{note}</div>}
              </section>
            ))}
          </div>
        </div>

        {freeDelivery && (
          <div className="ct-strip" id="free-delivery-nudge" role="status">
            <Icon name="solid:motorcycle" size={18} />
            <span className="ct-strip-copy">
              <span id="nudge-text">Free delivery unlocked</span>
              <span className="ct-strip-sub" id="nudge-sub">
                No delivery charge on this order
              </span>
            </span>
          </div>
        )}

        <section aria-labelledby="ct-sav-title" className="ct-card ct-savings" id="ct-payment-group">
          <h2 className="ct-sec-title" id="ct-sav-title">
            Savings corner
          </h2>
          <button className="ct-sav-row ct-sav-coupon" id="coupon-card" type="button" onClick={() => setSheet('coupon')}>
            <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--offer">
              <Icon name="solid:tag" size={22} />
            </span>
            <span className="ct-sav-copy">
              <span className="ct-sav-title">{coupon ? coupon.code : 'Apply coupon code'}</span>
              <span className="ct-sav-sub" id="coupon-card-sub">
                {coupon ? coupon.title : 'Save more on this order'}
              </span>
            </span>
            {coupon && (
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
                <span className="ct-sav-title">Free delivery applied</span>
              </span>
              <span className="ct-sav-flag is-static">
                <Icon name="solid:check" size={13} /> Applied
              </span>
            </div>
          )}
        </section>

        <section aria-label="Delivery and bill details" className="ct-oi-card" id="ct-order-info">
          <div className="ct-oi-row ct-oi-row--eta">
            <span aria-hidden="true" className="ct-oi-ic">
              {clockIcon}
            </span>
            <div className="ct-oi-copy">
              <span className="ct-oi-line">
                <span className="ct-oi-lead">Delivery in</span> <b>{eta}</b>
              </span>
              <button className="ctp-schedule-link" type="button" onClick={() => toast('Scheduling is not part of this demo')}>
                Want this later? Schedule it
              </button>
            </div>
          </div>
          <div className="ct-oi-row ct-oi-row--addr">
            <span aria-hidden="true" className="ct-oi-ic">
              <Icon name="solid:location-dot" size={22} />
            </span>
            <div className="ct-oi-copy">
              <button className="ct-oi-hit" type="button" onClick={() => toast('Address picker is not part of this demo')}>
                <span className="ct-oi-hit-copy">
                  <span className="ct-oi-line">
                    Delivery at <b>Home</b>
                  </span>
                  <span className="ct-oi-sub">{addressText}</span>
                </span>
                {chevron}
              </button>
              <button className="ct-oi-dashlink" type="button" onClick={() => setSheet('note')}>
                Add instructions for delivery partner
              </button>
            </div>
          </div>
          <button className="ct-oi-row ct-oi-row--link" type="button" onClick={() => toast('Contact details are part of the demo')}>
            <span aria-hidden="true" className="ct-oi-ic">
              <Icon name="solid:phone" size={22} />
            </span>
            <div className="ct-oi-copy">
              <span className="ct-oi-line">
                <span>{displayName}</span>
                <span aria-hidden="true" className="ct-oi-comma">, </span>
                <b>{phone}</b>
              </span>
              <span className="ct-oi-sub">Your rider may call this number for delivery updates</span>
            </div>
            {chevron}
          </button>
          <button className="ct-oi-row ct-oi-row--link ct-oi-row--bill" type="button" onClick={() => setSheet('bill')}>
            <span aria-hidden="true" className="ct-oi-ic">
              <Icon name="solid:receipt" size={22} />
            </span>
            <div className="ct-oi-copy">
              <span className="ct-oi-line">
                Total Bill <b>{formatMoney(bill.total)}</b>
                {savings > 0 && <span className="ct-oi-saved">You saved ₹{savings}</span>}
              </span>
              <span className="ct-oi-sub">Incl. taxes and charges</span>
            </div>
            {chevron}
          </button>
        </section>

        <section className="ct-oi-policy" aria-labelledby="ct-oi-policy-title">
          <h2 className="ct-oi-policy-title" id="ct-oi-policy-title">
            Cancellation policy
          </h2>
          <p>Please double-check your order and address details. Orders are non-refundable once placed.</p>
        </section>

        <div className="ct-footer" id="checkout-footer">
          {savings > 0 && (
            <button className="ct-footer-save ct-save-strip show" id="ct-footer-save" type="button" onClick={() => setSheet('bill')}>
              <span className="ct-save-text" id="ct-footer-save-text">
                ₹{savings} saved on this order with Navereat!
              </span>
            </button>
          )}
          <div className="ct-paybar">
            <button className="ct-paybar-left tap" type="button" onClick={() => setSheet('bill')}>
              <span className="ct-paybar-amt">{formatMoney(bill.total)}</span>
              <span className="ct-paybar-link">View detailed bill</span>
            </button>
            <button className="ct-cta" type="button" onClick={() => setSheet('pay')}>
              <span className="ct-cta-text">Proceed to Pay</span>
            </button>
          </div>
          <div className="ct-pay-note">
            <Icon name="solid:lock" size={12} />
            <span>Secure UPI payment · GPay, PhonePe &amp; more</span>
          </div>
        </div>
      </div>

      {sheet === 'coupon' && (
        <Sheet
          ref={sheetRef}
          id="ct-coupon-sheet"
          title="Apply coupon"
          onClose={() => setSheet(null)}
          floatingClose
          hideHeader
          footerClassName="is-single"
          footer={
            <button className="ct-btn ct-btn-ghost" type="button" onClick={closeSheet}>
              Close
            </button>
          }
        >
          {coupon && (
            <div className="ct-coupon-applied">
              <span className="ct-coupon-applied-copy">
                <span className="ct-coupon-applied-label">Applied coupon</span>
                <strong>{coupon.code} · {coupon.title}</strong>
              </span>
              <button
                className="ct-coupon-remove"
                type="button"
                onClick={() => {
                  removeCoupon();
                  toast('Coupon removed');
                }}
              >
                Remove
              </button>
            </div>
          )}
          <label className="ct-field-label" htmlFor="navereat-coupon-input">
            Coupon code
          </label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            className="ct-input"
            id="navereat-coupon-input"
            placeholder="Enter coupon code"
            spellCheck={false}
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button className="ct-btn ct-btn-primary" id="coupon-apply" type="button" onClick={() => handleApply(code)}>
            Apply coupon
          </button>
          <div className="navereat-coupon-list">
            {coupons.map((entry: Coupon) => (
              <button
                key={entry.code}
                type="button"
                className={`navereat-coupon-card${coupon?.code === entry.code ? ' is-applied' : ''}`}
                onClick={() => handleApply(entry.code)}
              >
                <span className="navereat-coupon-tag">
                  <Icon name="solid:percent" size={14} />
                </span>
                <span className="navereat-coupon-copy">
                  <strong>{entry.code}</strong>
                  <span>{entry.title}</span>
                  <small>{entry.subtitle}</small>
                </span>
                <span className="navereat-coupon-action">{coupon?.code === entry.code ? 'APPLIED' : 'APPLY'}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'bill' && (
        <Sheet ref={sheetRef} title="Bill summary" onClose={() => setSheet(null)}>
          <div className="ct-bill">
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
                <span className="ct-bill-label is-dashed">Delivery Fee</span>
                <span className="ct-bill-val is-free">{bill.deliveryFee > 0 ? formatMoney(bill.deliveryFee) : 'FREE'}</span>
              </div>
              <div className="ct-bill-row">
                <span className="ct-bill-label">Platform fee</span>
                <span className="ct-bill-val is-free">{formatMoney(bill.platformFee)}</span>
              </div>
              <div className="ct-bill-row">
                <span className="ct-bill-label">Packaging fee</span>
                <span className="ct-bill-val is-free">₹0</span>
              </div>
              {bill.discount > 0 && (
                <div className="ct-bill-row">
                  <span className="ct-bill-label">Coupon discount</span>
                  <span className="ct-bill-val is-save">-{formatMoney(bill.discount)}</span>
                </div>
              )}
            </div>
            <div className="ct-bill-band">THAT'S IT. No unnecessary fees. Ever!</div>
            <div className="ct-bill-total">
              <span className="ct-total-label">To Pay</span>
              <span className="ct-total-val">{formatMoney(bill.total)}</span>
            </div>
          </div>
        </Sheet>
      )}

      {sheet === 'pay' && (
        <Sheet ref={sheetRef} title="Select payment method" onClose={() => setSheet(null)}>
          <div className="ct-pay-opts" role="radiogroup" aria-label="Payment method">
            {[
              { id: 'upi' as const, title: 'UPI / Online Payment', sub: 'GPay, PhonePe, Paytm and more', icon: 'solid:wallet' as const },
              { id: 'cod' as const, title: 'Cash on Delivery (COD)', sub: 'Pay when your order arrives', icon: 'solid:money-bill-transfer' as const },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={payment === option.id}
                className={`ct-pay-opt${payment === option.id ? ' is-selected' : ''}`}
                onClick={() => setPayment(option.id)}
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
          <button className="ct-btn ct-btn-primary navereat-place-order" type="button" onClick={handlePlace}>
            Place Order · {formatMoney(bill.total)}
          </button>
        </Sheet>
      )}

      {sheet === 'note' && (
        <Sheet
          ref={sheetRef}
          title="Add a note for the restaurant"
          onClose={() => setSheet(null)}
          footer={
            <>
              <button className="ct-btn ct-btn-ghost" type="button" onClick={closeSheet}>
                Cancel
              </button>
              <button
                className="ct-btn ct-btn-primary"
                type="button"
                onClick={() => {
                  closeSheet();
                  toast(note ? 'Cooking request saved' : 'Cooking request removed');
                }}
              >
                Save note
              </button>
            </>
          }
        >
          <label className="ct-field-label" htmlFor="navereat-note-input">
            Your note
          </label>
          <textarea
            className="ct-textarea"
            id="navereat-note-input"
            maxLength={250}
            rows={3}
            placeholder="Example: Please make it less spicy"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="ct-field-foot">
            <span className="ct-field-help">The restaurant will see this with your order.</span>
            <span className="ct-count">{note.length}/250</span>
          </div>
        </Sheet>
      )}
    </div>
  );
}
