import { motion } from 'framer-motion';
import { Icon } from '../components/Icon';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import '../styles/pages/success.css';

export function Success() {
  const nav = useAppNav();
  const orders = useAppStore((s) => s.orders);
  const lastOrderId = useAppStore((s) => s.lastOrderId);
  const order = orders.find((entry) => entry.id === lastOrderId) ?? orders[0];

  return (
    <div className="page success-page">
      <div className="page-scroll success-scroll">
        <motion.div
          className="success-check"
          initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        >
          <Icon name="solid:check" size={44} />
        </motion.div>

        <h1 className="success-title">Order Placed!</h1>
        <p className="success-sub">
          {order ? `${order.restaurantName} is preparing your food.` : 'Your demo order is confirmed.'}
        </p>

        <div className="success-eta">
          <span className="success-eta-icon">
            <Icon name="solid:motorcycle" size={16} />
          </span>
          <div>
            <p className="success-eta-label">Estimated delivery</p>
            <p className="success-eta-value">{order?.eta ?? '30 mins'}</p>
          </div>
        </div>

        {order && (
          <div className="success-card">
            <div className="success-order-id">
              <span>ORDER ID</span>
              <span>{order.id}</span>
            </div>
            <p className="success-rest">{order.restaurantName}</p>
            {order.lines.map((line) => (
              <div className="success-line" key={line.name}>
                <span>
                  {line.qty} × {line.name}
                </span>
                <span>{formatMoney(line.qty * line.price)}</span>
              </div>
            ))}
            <div className="success-total">
              <span>Total paid</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>
        )}

        <div className="success-actions">
          {order && (
            <button type="button" className="success-btn primary" onClick={() => nav.push(`/track/${order.id}`)}>
              Track Order <Icon name="solid:arrow-right" size={14} />
            </button>
          )}
          <button type="button" className="success-btn ghost" onClick={() => nav.reset('/')}>
            Back to Home
          </button>
        </div>

        <p className="success-note">This is a demo order — no payment was taken.</p>
      </div>
    </div>
  );
}
