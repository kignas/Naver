import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DEMO_RIDER, demoOrders, findRestaurant, type Order } from '../data/demo';
import { formatMoney } from '../lib/money';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import trackBundleCss from '../styles/original/track-order.bundle.css?raw';
import '../styles/pages/track.css';

const FLOW: Array<{ key: string; label: string; sub: string }> = [
  { key: 'placed', label: 'Order placed', sub: 'We received your order' },
  { key: 'confirmed', label: 'Restaurant confirmed', sub: 'The restaurant accepted your order' },
  { key: 'preparing', label: 'Preparing your food', sub: 'Freshly cooking your dishes' },
  { key: 'picked_up', label: 'Delivery partner assigned', sub: 'Your rider is at the restaurant' },
  { key: 'on_the_way', label: 'On the way', sub: 'Your rider is heading to you' },
  { key: 'delivered', label: 'Delivered', sub: 'Enjoy your meal!' },
];

const stageFor = (status: string): number => {
  if (status === 'confirmed') return 1;
  if (status === 'preparing') return 2;
  if (status === 'picked_up') return 3;
  if (status === 'on_the_way') return 4;
  if (status === 'delivered') return 6;
  return 1;
};

const titleFor = (status: string): string => {
  if (status === 'confirmed') return 'Order confirmed';
  if (status === 'preparing') return 'Preparing your food';
  if (status === 'picked_up') return 'Picked up by rider';
  if (status === 'on_the_way') return 'On the way';
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Order cancelled';
  return 'Order placed';
};

const subFor = (status: string): string => {
  if (status === 'confirmed') return 'The restaurant is getting your order ready';
  if (status === 'preparing') return 'Your food is being freshly prepared';
  if (status === 'picked_up') return 'Your rider has collected the order';
  if (status === 'on_the_way') return 'Your rider is heading to your address';
  if (status === 'delivered') return 'Your order has reached you';
  if (status === 'cancelled') return 'This order was cancelled';
  return 'Waiting for the restaurant to confirm';
};

const shortId = (id: string): string => id.replace(/\D/g, '').slice(-5);

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const trackStyle = createRouteStyleSheet(trackBundleCss, 'navereatTrack');

export function Track() {
  const { id } = useParams<{ id: string }>();
  const nav = useAppNav();
  const orders = useAppStore((s) => s.orders);
  const user = useAppStore((s) => s.user);
  const addItem = useAppStore((s) => s.addItem);

  useLayoutEffect(() => trackStyle.attach(), []);

  const order = useMemo<Order | undefined>(
    () => orders.find((entry) => entry.id === id) ?? demoOrders[0],
    [orders, id],
  );

  const restaurant = order ? findRestaurant(order.restaurantId) : undefined;
  const stage = order ? stageFor(order.status) : 1;
  const delivered = order?.status === 'delivered';
  const cancelled = order?.status === 'cancelled';
  const [demoStage, setDemoStage] = useState(stage);

  useEffect(() => {
    setDemoStage(stage);
    if (delivered || cancelled) return;
    const timer = window.setInterval(() => setDemoStage((current) => Math.min(current + 1, 5)), 9000);
    return () => window.clearInterval(timer);
  }, [stage, delivered, cancelled, order?.id]);

  const activeStage = Math.max(stage, demoStage);
  const rider = DEMO_RIDER;
  const etaDigits = order?.eta.match(/\d+/)?.[0] ?? '12';
  const payment = order?.paymentMethod ?? 'UPI';
  const isCod = payment.toLowerCase().includes('cash');

  const billRows = useMemo(() => {
    if (!order) return [];
    return [
      { label: 'Item total', value: formatMoney(order.subtotal) },
      { label: 'Delivery partner fee', value: 'FREE', free: true },
      ...(order.platformFee > 0 ? [{ label: 'Platform fee', value: formatMoney(order.platformFee) }] : []),
      ...(order.discount > 0 ? [{ label: 'Coupon discount', value: `− ${formatMoney(order.discount)}`, discount: true }] : []),
    ];
  }, [order]);

  const handleReorder = () => {
    if (!order || !restaurant) {
      toast('This restaurant is not available in the demo', 'error');
      return;
    }
    order.lines.forEach((line) => {
      const menuItem = restaurant.menu.find((item) => item.name === line.name);
      if (!menuItem) return;
      for (let index = 0; index < line.qty; index += 1) addItem(menuItem, restaurant.id);
    });
    toast('Items added to your cart', 'success');
    nav.push('/cart');
  };

  if (!order) {
    return (
      <div className="page track-page">
        <header className="app-bar">
          <div className="app-bar-row">
            <button className="ab-btn floating-back tap" type="button" aria-label="Back" onClick={nav.back} />
            <h1 className="ab-center">Order Details</h1>
          </div>
        </header>
        <div className="tracking-sheet">
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Order not found</h2>
            <p style={{ marginTop: 6, color: 'var(--ink-500)' }}>This demo order does not exist.</p>
            <button className="btn-primary tap" style={{ marginTop: 16, padding: '0 20px' }} type="button" onClick={nav.back}>
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page track-page">
      <header className="app-bar">
        <div className="app-bar-row">
          <button className="ab-btn floating-back tap" type="button" aria-label="Back to orders" onClick={nav.back}>
            <span className="track-back-arrow">
              <Icon name="solid:arrow-left" size={18} />
            </span>
          </button>
          <h1 className="ab-center">Order Details</h1>
          <button className="ab-support tap" type="button" onClick={() => toast('Support is not part of this demo')}>
            <Icon name="solid:comment-dots" size={16} />
            <span>Support</span>
          </button>
          <button className="ab-btn tap" type="button" aria-label="Share tracking link" onClick={() => toast('Sharing is part of the demo')}>
            <Icon name="solid:share-nodes" size={17} />
          </button>
        </div>
      </header>

      <section className="map-stage" aria-label="Delivery map preview">
        <div className="map-visual">
          <svg className="track-map-placeholder" viewBox="0 0 390 210" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Static demo delivery map">
            <rect width="390" height="210" fill="#E8EFE6" />
            <rect x="12" y="14" width="108" height="54" rx="8" fill="#DCE8DC" />
            <rect x="142" y="8" width="92" height="48" rx="8" fill="#E1EDE1" />
            <rect x="256" y="20" width="120" height="62" rx="8" fill="#DCE8DC" />
            <rect x="18" y="112" width="82" height="82" rx="8" fill="#E1EDE1" />
            <rect x="132" y="128" width="112" height="68" rx="8" fill="#DCE8DC" />
            <rect x="276" y="116" width="102" height="80" rx="8" fill="#E1EDE1" />
            <path d="M0 92H390" stroke="#fff" strokeWidth="20" />
            <path d="M122 0V210" stroke="#fff" strokeWidth="15" />
            <path d="M262 0V210" stroke="#fff" strokeWidth="13" />
            <path d="M0 92H390" stroke="#F3D9A4" strokeWidth="2" strokeDasharray="10 10" />
            <path d="M40 184C92 176 86 126 142 114S238 132 272 82s42-28 68-32" fill="none" stroke="#23956D" strokeWidth="4" strokeDasharray="8 8" className="track-map-route" />
            <circle cx="40" cy="184" r="11" fill="#fff" stroke="#23956D" strokeWidth="3" />
            <circle cx="40" cy="184" r="4" fill="#23956D" />
            <circle cx="340" cy="50" r="11" fill="#23956D" />
            <path d="m334 50 4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle r="7" fill="#fff" stroke="#23956D" strokeWidth="3" className="track-map-rider">
              <animateMotion dur="10s" repeatCount="indefinite" path="M40 184C92 176 86 126 142 114S238 132 272 82s42-28 68-32" />
            </circle>
            <text x="40" y="166" textAnchor="middle" fill="#5C6B61" fontSize="10" fontWeight="700">Restaurant</text>
            <text x="340" y="75" textAnchor="middle" fill="#5C6B61" fontSize="10" fontWeight="700">You</text>
          </svg>
          <button className="map-recenter tap show" type="button" onClick={() => toast('Map re-center is part of the demo')}>
            <Icon name="solid:location-dot" size={14} /> Re-center
          </button>
        </div>
        <div className="map-chip">
          <Icon name="solid:motorcycle" size={15} />
          <span>
            {rider.name} is 1.2 km away · arriving in {etaDigits} mins
          </span>
        </div>
      </section>

      <div className="tracking-sheet">
        <div className="tracker-hero card-fade" role="status" aria-live="polite">
          <div className="hero-icon-wrapper">
            <Icon name="solid:receipt" size={19} />
          </div>
          <div className="status-text">
            <div className="status-title">{titleFor(order.status)}</div>
            <div className="status-sub">{subFor(order.status)}</div>
          </div>
          <div className="hero-foot">
            <button
              className="hero-items tap"
              type="button"
              onClick={() => document.getElementById('track-order-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <span className="hero-items-ic">
                <Icon name="solid:bag-shopping" size={16} />
              </span>
              <span>View item list</span>
            </button>
          </div>
        </div>

        {!delivered && !cancelled && (
          <div className="rider-card card-fade d2">
            <div className="rider-left">
              <div className="rider-photo">
                <Icon name="solid:user" size={18} />
              </div>
              <div className="rider-info">
                <div className="rider-kicker">Delivery partner</div>
                <h3>{rider.name}</h3>
                <div className="rider-meta-row">
                  <span className="rider-rating">
                    <Icon name="solid:star" size={10} /> {rider.rating}
                  </span>
                  <span className="rider-vehicle">
                    <Icon name="solid:motorcycle" size={11} /> {rider.vehicle}
                  </span>
                </div>
              </div>
            </div>
            <div className="rider-actions">
              <button className="btn-action btn-message tap" type="button" onClick={() => toast('Chat is not part of this demo')}>
                <Icon name="solid:comment-dots" size={13} /> Message
              </button>
              <button className="btn-action btn-call tap" type="button" onClick={() => toast(`Calling ${rider.name} (demo)`)}>
                <Icon name="solid:phone" size={13} /> Call
              </button>
            </div>
          </div>
        )}

        <div className="timeline-card card-fade d3">
          <div className="timeline-card-title">Order progress</div>
          <ol className="tl">
            {FLOW.map((step, index) => {
              const done = delivered || index < activeStage;
              const current = !delivered && index === activeStage;
              return (
                <li className={`tl-step${done ? ' done' : ''}${current ? ' current' : ''}`} key={step.key}>
                  <span className="tl-dot">{done ? <Icon name="solid:check" size={9} /> : null}</span>
                  <span className="tl-label">
                    {step.label}
                    {current && <span className="tl-sub" style={{ display: 'block' }}>{step.sub}</span>}
                  </span>
                  <span className="tl-time">{index === 0 ? fmtTime(order.placedAt) : current ? 'Now' : ''}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="od-card card-fade d3" id="track-order-items">
          <div className="info-card">
            <div className="hero-logo">{order.restaurantName.charAt(0)}</div>
            <div className="info-card-body">
              <div className="info-card-title">{order.restaurantName}</div>
              <div className="info-card-sub">{restaurant ? `${restaurant.cuisine} · Demo City` : 'Demo City'}</div>
            </div>
          </div>
          <div className="od-items">
            <div className="od-id-row">
              <span className="order-id">Order ID: #{shortId(order.id)}</span>
              <button className="copy-id tap" type="button" aria-label="Copy order ID" onClick={() => toast('Order ID copied (demo)')}>
                <Icon name="regular:file-lines" size={14} />
              </button>
            </div>
            <div className="od-placed">Placed on {fmtDate(order.placedAt)}</div>
            <div className="summary-items-list">
              {order.lines.map((line) => {
                const menuItem = restaurant?.menu.find((item) => item.name === line.name);
                return (
                  <div className="item-row" key={line.name}>
                    <span className={`veg-mark ${menuItem?.isVeg === false ? 'nonveg' : 'veg'}`}>
                      <i />
                    </span>
                    <span className="item-qty">{line.qty}x</span>
                    <span className="item-name">{line.name}</span>
                    <span className="item-price">{formatMoney(line.price * line.qty)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bill-card card-fade d4">
          <div className="bill-head">
            <span className="bill-ico">
              <Icon name="solid:receipt" size={15} />
            </span>
            <h3>Bill summary</h3>
          </div>
          <div className="bill-body">
            <div className="summary-charges">
              {billRows.map((row) => (
                <div className={`charge-row${row.discount ? ' discount' : ''}`} key={row.label}>
                  <span>{row.label}</span>
                  <span className="charge-val">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="summary-total">
              <span className="total-label">Grand total</span>
              <span className="total-price">{formatMoney(order.total)}</span>
            </div>
            <button className="invoice-btn tap" type="button" onClick={() => toast('Invoice is part of the demo')}>
              <Icon name="regular:file-lines" size={13} /> View invoice
            </button>
          </div>
        </div>

        <div className="details-card card-fade d4">
          <div className="d-row">
            <div className="d-ico">
              <Icon name="solid:wallet" size={14} />
            </div>
            <div className="d-body">
              <div className="d-title">Payment method</div>
              <div className="d-sub">{isCod ? 'Cash on Delivery' : 'UPI'}</div>
            </div>
            <span className={`pay-status-pill ${isCod ? 'warn' : 'good'}`}>{isCod ? 'Pay on delivery' : 'Paid'}</span>
          </div>
          <div className="d-row">
            <div className="d-ico">
              <Icon name="solid:user" size={14} />
            </div>
            <div className="d-body">
              <div className="d-title">{user?.name ?? 'Demo Foodie'}</div>
              <div className="d-sub">{user?.phone ?? '+91 98765 43210'}</div>
            </div>
          </div>
          <div className="d-row">
            <div className="d-ico">
              <Icon name="solid:location-dot" size={14} />
            </div>
            <div className="d-body">
              <div className="d-title">Delivery address</div>
              <div className="d-sub">{order.address}</div>
            </div>
          </div>
        </div>

        <div className="help-card card-fade d5">
          <div className="help-card-title">Need help with this order?</div>
          <div className="help-grid">
            <button className="help-item tap" type="button" onClick={() => toast('Chat support is not part of this demo')}>
              <Icon name="solid:comment-dots" size={13} /> Chat with us
            </button>
            <button className="help-item tap" type="button" onClick={() => toast('Report issue is part of the demo')}>
              <Icon name="solid:circle-exclamation" size={13} /> Report an issue
            </button>
          </div>
        </div>

        <div className="track-actions">
          <button className="btn-secondary tap" type="button" onClick={() => nav.tab('/orders')}>
            Back to orders
          </button>
          <button className="btn-primary tap" type="button" onClick={handleReorder}>
            Order again
          </button>
        </div>
      </div>
    </div>
  );
}
