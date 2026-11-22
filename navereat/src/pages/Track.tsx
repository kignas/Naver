import { useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DEMO_RIDER, type Order } from '../data/demo';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import '../styles/pages/track.css';

const STEP_KEYS = ['confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered'] as const;

const STEPS = [
  { key: 'confirmed', label: 'Order confirmed', desc: 'Restaurant accepted your order' },
  { key: 'preparing', label: 'Preparing your food', desc: 'Freshly cooking your dishes' },
  { key: 'picked_up', label: 'Picked up by rider', desc: 'Your rider collected the order' },
  { key: 'on_the_way', label: 'On the way', desc: 'Rider is heading to your address' },
  { key: 'delivered', label: 'Delivered', desc: 'Enjoy your meal!' },
] as const;

const statusLabel = (order: Order): string => {
  switch (order.status) {
    case 'confirmed':
      return 'Confirmed';
    case 'preparing':
      return 'Preparing';
    case 'picked_up':
      return 'Picked up';
    case 'on_the_way':
      return 'On the way';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return order.status;
  }
};

export function Track() {
  const { id } = useParams<{ id: string }>();
  const nav = useAppNav();
  const orders = useAppStore((s) => s.orders);
  const order = orders.find((entry) => entry.id === id);

  if (!order) {
    return (
      <div className="page track-page">
        <div className="page-scroll">
          <div className="track-header">
            <button type="button" className="track-back tap" onClick={nav.back} aria-label="Back">
              <Icon name="solid:chevron-left" size={14} />
            </button>
            <h1 className="track-header-title">Track Order</h1>
          </div>
          <div className="cat-empty" style={{ padding: '64px 24px' }}>
            <div className="cat-empty-icon">
              <Icon name="solid:bag-shopping" size={36} />
            </div>
            <h2>Order not found</h2>
            <p>This demo order does not exist.</p>
            <button type="button" className="cat-empty-btn" onClick={nav.back}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentIndex = STEP_KEYS.indexOf(order.status as (typeof STEP_KEYS)[number]);
  const activeIndex = currentIndex < 0 ? 0 : currentIndex;
  const delivered = order.status === 'delivered';

  return (
    <div className="page track-page">
      <div className="track-header">
          <button type="button" className="track-back tap" onClick={nav.back} aria-label="Back">
            <Icon name="solid:chevron-left" size={14} />
          </button>
          <div>
            <h1 className="track-header-title">Track Order</h1>
            <p className="track-header-sub">
              {order.id} · {order.restaurantName}
            </p>
          </div>
      </div>

      <div className="page-scroll track-scroll">
        <div className="track-map-wrap">
          <svg className="track-map" viewBox="0 0 400 230" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Demo delivery map">
            <rect width="400" height="230" fill="#eef4ec" />
            <rect x="12" y="18" width="120" height="62" rx="8" fill="#e3ece5" />
            <rect x="160" y="10" width="98" height="54" rx="8" fill="#e6efe7" />
            <rect x="286" y="24" width="100" height="70" rx="8" fill="#e3ece5" />
            <rect x="20" y="118" width="86" height="90" rx="8" fill="#e6efe7" />
            <rect x="140" y="140" width="120" height="72" rx="8" fill="#e3ece5" />
            <rect x="292" y="126" width="94" height="86" rx="8" fill="#e6efe7" />
            <path d="M0 100 H400" stroke="#ffffff" strokeWidth="18" />
            <path d="M128 0 V230" stroke="#ffffff" strokeWidth="14" />
            <path d="M276 0 V230" stroke="#ffffff" strokeWidth="12" />
            <path d="M0 100 H400" stroke="#f3d9a4" strokeWidth="2" strokeDasharray="10 10" />
            <path d="M40 190 C 100 180, 90 120, 150 110 S 250 130, 280 80 S 320 60, 350 55" fill="none" stroke="#fc8019" strokeWidth="4" strokeDasharray="8 8" style={{ animation: 'dash 1.2s linear infinite' }} />
            <circle cx="40" cy="190" r="11" fill="#ffffff" stroke="#fc8019" strokeWidth="3" />
            <circle cx="40" cy="190" r="4" fill="#fc8019" />
            <circle cx="350" cy="55" r="11" fill="#16a34a" />
            <path d="M344 55l4 4 8-9" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x="40" y="170" textAnchor="middle" className="track-map-label">Restaurant</text>
            <text x="350" y="80" textAnchor="middle" className="track-map-label">You</text>
            <circle r="7" fill="#ffffff" stroke="#fc8019" strokeWidth="3">
              <animateMotion
                dur="9s"
                repeatCount="indefinite"
                path="M40 190 C 100 180, 90 120, 150 110 S 250 130, 280 80 S 320 60, 350 55"
              />
            </circle>
          </svg>
          <div className="track-eta">
            <div>
              <p className="track-eta-label">Estimated arrival</p>
              <p className="track-eta-value">{delivered ? 'Delivered' : order.eta}</p>
            </div>
            <span className="track-eta-badge">{statusLabel(order)}</span>
          </div>
        </div>

        <div className="track-card">
          <h3 className="track-card-title">
            <Icon name="solid:list" size={14} /> Order Status
          </h3>
          <div className="track-steps">
            {STEPS.map((step, index) => {
              const done = index < activeIndex || delivered;
              const current = index === activeIndex && !delivered;
              return (
                <div className={`track-step${done ? ' done' : ''}${current ? ' current' : ''}`} key={step.key}>
                  <p className="track-step-name">{step.label}</p>
                  <p className="track-step-desc">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {!delivered && (
          <div className="track-card">
            <h3 className="track-card-title">
              <Icon name="solid:motorcycle" size={14} /> Your Rider
            </h3>
            <div className="rider-row">
              <span className="rider-avatar">RD</span>
              <div className="rider-info">
                <p className="rider-name">{DEMO_RIDER.name}</p>
                <p className="rider-meta">
                  {DEMO_RIDER.vehicle} ·{' '}
                  <span className="rider-rating">
                    <Icon name="solid:star" size={8} /> {DEMO_RIDER.rating}
                  </span>
                </p>
              </div>
              <div className="rider-actions">
                <button
                  type="button"
                  className="rider-btn call tap"
                  aria-label="Call rider"
                  onClick={() => toast(`Calling ${DEMO_RIDER.name} (demo)`, 'success')}
                >
                  <Icon name="solid:phone" size={14} />
                </button>
                <button
                  type="button"
                  className="rider-btn tap"
                  aria-label="Message rider"
                  onClick={() => toast('Chat is not part of this demo')}
                >
                  <Icon name="solid:comment-dots" size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="track-card">
          <h3 className="track-card-title">
            <Icon name="solid:receipt" size={14} /> Order Summary
          </h3>
          {order.lines.map((line) => (
            <div className="track-line" key={line.name}>
              <span>
                {line.qty} × {line.name}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--g800)' }}>{formatMoney(line.qty * line.price)}</span>
            </div>
          ))}
          {order.discount > 0 && (
            <div className="track-line">
              <span>Coupon discount</span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>− {formatMoney(order.discount)}</span>
            </div>
          )}
          <div className="track-total">
            <span>Total</span>
            <span>{formatMoney(order.total)}</span>
          </div>
        </div>

        <div className="track-card">
          <h3 className="track-card-title">
            <Icon name="solid:location-dot" size={14} /> Delivering To
          </h3>
          <div className="track-address">
            <span className="track-address-icon">
              <Icon name="solid:house" size={13} />
            </span>
            <div>
              <p className="track-address-label">Home</p>
              <p className="track-address-text">{order.address}</p>
              <p className="track-address-text" style={{ marginTop: 4 }}>
                Payment · {order.paymentMethod}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
