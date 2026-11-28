import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../api/restaurantApi';
import type { Order } from '../data/demo';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { paymentState } from '../logic/paymentState';
import paymentBundleCss from '../styles/original/payment.bundle.css?raw';

type ResultState = 'success' | 'failed' | 'pending';

const RESULT_STATES: ResultState[] = ['success', 'failed', 'pending'];

const parseState = (raw: string | undefined): ResultState =>
  RESULT_STATES.includes(raw as ResultState) ? (raw as ResultState) : 'pending';

const hashParam = (key: string): string => {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get(key) ?? '';
};

const SPARKS = [15, 72, 128, 182, 236, 302];

export default function PaymentResult() {
  const nav = useAppNav();
  const path = window.location.hash.replace(/^#/, '').split('?')[0];
  const state = parseState(path.split('/')[2]);
  const orderId = useMemo(() => hashParam('order'), []);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const sheet = createRouteStyleSheet(paymentBundleCss, 'navereatPayment');
    const detach = sheet.attach();
    return detach;
  }, []);

  useEffect(() => {
    let alive = true;
    if (!orderId) return;
    api
      .getOrder(orderId)
      .then((found) => {
        if (alive) setOrder(found);
      })
      .catch(() => {
        /* the page still renders its result copy */
      });
    return () => {
      alive = false;
    };
  }, [orderId]);

  const total = paymentState.authoritativeTotal(order as never);
  const number = order?.id ?? orderId;

  if (state === 'failed') {
    return (
      <div className="payment-page">
      <main className="ew-result ew-fail" data-payment-result="failed">
        <div className="ew-icon-wrap">
          <span className="ew-halo" aria-hidden="true" />
          <div className="ew-icon" aria-hidden="true">
            <svg className="ew-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle className="ew-ring" cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" />
              <path className="ew-draw" d="M17 17l14 14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              <path
                className="ew-draw"
                style={{ animationDelay: '.66s' }}
                d="M31 17 17 31"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <h1 className="ew-title">Payment not completed</h1>
        <p className="ew-copy">Your cart is still saved. You can safely try the payment again.</p>
        {number ? (
          <div className="ew-order">
            <div className="ew-order-row">
              <span className="ew-order-label">Order number</span>
              <span className="ew-order-value">{number}</span>
            </div>
          </div>
        ) : null}
        <div className="ew-actions">
          <button className="ew-btn ew-btn-primary" id="ew-retry" type="button" onClick={() => nav.push('/cart')}>
            Try payment again
          </button>
          <button className="ew-btn ew-btn-ghost" id="ew-cart" type="button" onClick={() => nav.push('/cart')}>
            Return to cart
          </button>
        </div>
        <p className="ew-note">
          If your bank shows a debit, don't pay again immediately. Use My Orders or wait for the payment status to
          update.
        </p>
      </main>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="payment-page">
      <main className="ew-result ew-pending" id="ew-main" data-state="verifying" aria-live="polite" data-payment-result="pending">
        <div className="ew-icon-wrap">
          <span className="ew-halo" aria-hidden="true" />
          <div className="ew-icon" aria-hidden="true">
            <svg className="ew-svg ew-svg--wait" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="19" stroke="currentColor" strokeOpacity=".16" strokeWidth="3" />
              <circle className="ew-arc" cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="30 90" />
              <circle className="ew-arc ew-arc--b" cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="12 63" />
            </svg>
            {SPARKS.map((angle) => (
              <span
                key={angle}
                className="ew-spark ew-spark--dot"
                style={{ '--a': `${angle}deg` } as CSSProperties}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
        <h1 className="ew-title" id="ew-title">
          Confirming your payment
        </h1>
        <p className="ew-copy" id="ew-copy">
          This usually takes a few seconds. Please don't close this page.
        </p>
        <div className="ew-order">
          <div className="ew-order-row">
            <span className="ew-order-label">Order number</span>
            <span className="ew-order-value">{number}</span>
          </div>
          {total != null ? (
            <div className="ew-order-row">
              <span className="ew-order-label">Amount</span>
              <span className="ew-order-value ew-amount-value">{formatMoney(total)}</span>
            </div>
          ) : null}
        </div>
        <ol className="ew-steps" aria-label="Payment verification steps">
          <li className="is-done">
            <span className="ew-step-dot" aria-hidden="true" />
            <span className="ew-step-label">Payment sent</span>
          </li>
          <li className="is-active">
            <span className="ew-step-dot" aria-hidden="true">
              <span className="ew-step-pulse" aria-hidden="true" />
            </span>
            <span className="ew-step-label">Confirming with your bank</span>
          </li>
          <li>
            <span className="ew-step-dot" aria-hidden="true" />
            <span className="ew-step-label">Order confirmed</span>
          </li>
        </ol>
        <div className="ew-actions">
          <button className="ew-btn ew-btn-primary" id="ew-orders" type="button" onClick={() => nav.tab('/orders')}>
            Go to My Orders
          </button>
        </div>
      </main>
      </div>
    );
  }

  return (
    <main className="ew-result ew-success" aria-live="polite" data-payment-result="success">
      <div className="ew-icon-wrap">
        <span className="ew-halo" aria-hidden="true" />
        <div className="ew-icon" aria-hidden="true">
          <svg className="ew-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle className="ew-ring" cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" />
            <path
              className="ew-draw"
              d="m14.5 24.5 6.2 6.1L34 17.8"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {SPARKS.map((angle) => (
            <span
              key={angle}
              className="ew-spark ew-spark--dot"
              style={{ '--a': `${angle}deg` } as CSSProperties}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <h1 className="ew-title">Payment successful</h1>
      <p className="ew-copy">Your payment has been verified. Your order is now confirmed.</p>
      <div className="ew-order">
        <div className="ew-order-row">
          <span className="ew-order-label">Order number</span>
          <span className="ew-order-value">{number}</span>
        </div>
        <p className="ew-order-meta">Payment verified · Order confirmed</p>
      </div>
      <div className="ew-actions">
        <button className="ew-btn ew-btn-primary" id="ew-continue" type="button" onClick={() => nav.push(`/track/${number}`)}>
          Continue to order
        </button>
      </div>
      <div className="ew-redirect">
        <div className="ew-redirect-bar" aria-hidden="true">
          <span className="ew-redirect-fill" />
        </div>
        <p className="ew-note">Please don't close the page while we finish opening your order.</p>
      </div>
    </main>
  );
}
