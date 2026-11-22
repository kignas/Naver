import { useState } from 'react';
import { Icon } from '../components/Icon';
import { QtyControl } from '../components/QtyControl';
import { coupons, DEMO_ADDRESS, findRestaurant, paymentMethods } from '../data/demo';
import { billFor, cartRestaurantId } from '../lib/cart';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import '../styles/pages/cart.css';

const PAY_ICONS = ['solid:money-bill-transfer', 'solid:wallet', 'solid:credit-card'] as const;

export function Cart() {
  const nav = useAppNav();
  const cart = useAppStore((s) => s.cart);
  const coupon = useAppStore((s) => s.coupon);
  const setQty = useAppStore((s) => s.setQty);
  const clearCart = useAppStore((s) => s.clearCart);
  const applyCoupon = useAppStore((s) => s.applyCoupon);
  const removeCoupon = useAppStore((s) => s.removeCoupon);
  const placeOrder = useAppStore((s) => s.placeOrder);
  const [code, setCode] = useState('');
  const [payment, setPayment] = useState(paymentMethods[0]);

  const lines = Object.entries(cart).map(([name, line]) => ({ name, ...line }));
  const bill = billFor(cart, coupon);
  const restaurant = findRestaurant(cartRestaurantId(cart) ?? undefined);

  const handleApply = (value: string) => {
    const result = applyCoupon(value);
    toast(result.message, result.ok ? 'success' : 'error');
    if (result.ok) setCode('');
  };

  const handlePlaceOrder = () => {
    const order = placeOrder(payment);
    if (!order) {
      toast('Your cart is empty', 'error');
      return;
    }
    toast(`Order ${order.id} placed`, 'success');
    nav.push('/success');
  };

  return (
    <div className="page cart-page">
      <div className="cart-header">
          <div className="cart-header-left">
            <button type="button" className="cart-back tap" onClick={nav.back} aria-label="Back">
              <Icon name="solid:chevron-left" size={14} />
            </button>
            <div>
              <h1 className="cart-title">Your Cart</h1>
              <p className="cart-rest">{restaurant?.name ?? (lines.length ? 'Your items' : '')}</p>
            </div>
          </div>
          {lines.length > 0 && (
            <button
              type="button"
              className="cart-clear tap"
              onClick={() => {
                clearCart();
                toast('Cart cleared');
              }}
            >
              Clear
            </button>
          )}
      </div>

      <div className="page-scroll cart-scroll">
        {lines.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">
              <Icon name="solid:bag-shopping" size={40} />
            </div>
            <h4>Your cart is empty</h4>
            <p>Add items from a restaurant to get started</p>
            <button type="button" className="cart-empty-btn tap" onClick={() => nav.tab('/')}>
              Explore Restaurants
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {lines.map((line) => (
                <div className="cart-item" key={line.name}>
                  <div className="cart-item-info">
                    <p className="cart-item-name">{line.name}</p>
                    <p className="cart-item-price">{formatMoney(line.price)} each</p>
                  </div>
                  <div className="cart-item-right">
                    <QtyControl
                      qty={line.quantity}
                      onAdd={() => setQty(line.name, line.quantity + 1)}
                      onRemove={() => setQty(line.name, line.quantity - 1)}
                    />
                    <span className="cart-item-total">{formatMoney(line.quantity * line.price)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-card">
              <h3 className="cart-card-title">
                <Icon name="solid:receipt" size={14} /> Bill Summary
              </h3>
              <div className="bill-row">
                <span className="bill-label">Item Total</span>
                <span className="bill-value">{formatMoney(bill.subtotal)}</span>
              </div>
              <div className="bill-row">
                <span className="bill-label">Delivery Fee</span>
                <span className="bill-free">FREE</span>
              </div>
              <div className="bill-row">
                <span className="bill-label">Platform Fee</span>
                <span className="bill-value">{formatMoney(bill.platformFee)}</span>
              </div>
              {coupon && bill.discount > 0 && (
                <div className="bill-row">
                  <span className="bill-label">Coupon ({coupon.code})</span>
                  <span className="bill-discount">− {formatMoney(bill.discount)}</span>
                </div>
              )}
              <div className="bill-total">
                <span className="bill-total-label">To Pay</span>
                <span className="bill-total-value">{formatMoney(bill.total)}</span>
              </div>
            </div>

            <div className="cart-card">
              <h3 className="cart-card-title">
                <Icon name="solid:ticket" size={14} /> Coupons
              </h3>
              {coupons.map((entry) => {
                const applied = coupon?.code === entry.code;
                return (
                  <div className="coupon-row" key={entry.code}>
                    <span className="coupon-badge">
                      <Icon name="solid:percent" size={14} />
                    </span>
                    <div className="coupon-info">
                      <p className="coupon-code">
                        {entry.code} · {entry.title}
                      </p>
                      <p className="coupon-desc">{entry.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      className={`coupon-apply${applied ? ' applied' : ''}`}
                      onClick={() => {
                        if (applied) {
                          removeCoupon();
                          toast('Coupon removed');
                        } else {
                          handleApply(entry.code);
                        }
                      }}
                    >
                      {applied ? 'APPLIED' : 'APPLY'}
                    </button>
                  </div>
                );
              })}
              <div className="coupon-input-row">
                <input
                  className="coupon-input"
                  placeholder="Enter coupon code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  aria-label="Coupon code"
                />
                <button type="button" className="coupon-input-btn" onClick={() => handleApply(code)}>
                  APPLY
                </button>
              </div>
            </div>

            <div className="cart-card">
              <h3 className="cart-card-title">
                <Icon name="solid:location-dot" size={14} /> Delivery Address
              </h3>
              <div className="address-line">
                <span className="address-icon">
                  <Icon name="solid:house" size={14} />
                </span>
                <div className="address-body">
                  <p className="address-label">Home</p>
                  <p className="address-text">{DEMO_ADDRESS}</p>
                </div>
                <button
                  type="button"
                  className="address-change"
                  onClick={() => toast('Address picker is not part of this demo')}
                >
                  CHANGE
                </button>
              </div>
            </div>

            <div className="cart-card">
              <h3 className="cart-card-title">
                <Icon name="solid:credit-card" size={14} /> Payment Method
              </h3>
              {paymentMethods.map((method, index) => (
                <button
                  key={method}
                  type="button"
                  className={`pay-option${payment === method ? ' selected' : ''}`}
                  onClick={() => setPayment(method)}
                >
                  <span className="pay-icon">
                    <Icon name={PAY_ICONS[index] ?? 'solid:credit-card'} size={14} />
                  </span>
                  <span className="pay-name">{method}</span>
                  <span className="pay-radio">
                    <span className="pay-radio-dot" />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {lines.length > 0 && (
        <div className="cart-footer">
          <button type="button" className="place-order" onClick={handlePlaceOrder}>
            <span>PLACE ORDER</span>
            <span>{formatMoney(bill.total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
