import { useLayoutEffect, useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import { findRestaurant, type Order } from '../data/demo';
import { formatMoney } from '../lib/money';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import ordersBundleCss from '../styles/original/orders.bundle.css?raw';
import ordersShellCss from '../styles/original/orders-shell.css?raw';
import '../styles/pages/orders.css';

const ACTIVE_STATUSES = new Set(['confirmed', 'preparing', 'picked_up', 'on_the_way']);

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
      return 'Order cancelled';
    default:
      return order.status;
  }
};

const paymentShort = (order: Order): string =>
  order.paymentMethod.toLowerCase().includes('cash') ? 'Cash on delivery' : 'Payment pending';

const orderDate = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const initial = (name: string): string => (name ? name.charAt(0).toUpperCase() : 'N');

const navOverride = `
.orders-page .bottom-nav{background:#fffdf8!important;height:calc(var(--nav-h) + var(--sab))!important;padding-bottom:var(--sab)!important;border-top:1px solid rgba(93,13,24,.12)!important;box-shadow:0 -6px 18px rgba(93,13,24,.07)!important}
.orders-page .nav-item{color:#9b8b84!important}
.orders-page .nav-item.active{color:var(--theme-burgundy)!important}
.orders-page .nav-item.active::before{content:'';position:absolute;top:0;left:50%;width:28px;height:3px;border-radius:0 0 3px 3px;background:var(--theme-gold)}
.orders-page .nav-item span{font-family:var(--font)!important}
`;

function PastCard({ order, onReorder }: { order: Order; onReorder: (order: Order) => void }) {
  const nav = useAppNav();
  const items = order.lines.slice(0, 3);
  const rest = order.lines.length - items.length;
  const active = ACTIVE_STATUSES.has(order.status);

  return (
    <article className="order-card ord-card" data-order-id={order.id}>
      <div className="ord-card-head">
        <div className="oc-logo" aria-hidden="true">
          {initial(order.restaurantName)}
        </div>
        <div className="ord-title">
          <h4 className="ord-name">{order.restaurantName}</h4>
          <div className="ord-loc">Demo City</div>
          <button
            type="button"
            className="ord-view-menu"
            onClick={() => nav.push(`/restaurant/${order.restaurantId}`)}
          >
            View menu <Icon name="solid:chevron-right" size={11} />
          </button>
        </div>
        <button
          type="button"
          className="ord-menu-btn tap"
          aria-label="Order options"
          onClick={() => toast('Order options are part of the demo')}
        >
          <Icon name="solid:ellipsis-vertical" size={16} />
        </button>
      </div>

      <ul className="past-items">
        {items.map((line) => (
          <li key={line.name}>
            <span className="ord-item-type unknown" role="img" aria-label="Food type not provided" />
            <span className="q">{line.qty} ×</span>
            <span className="n">{line.name}</span>
          </li>
        ))}
        {rest > 0 && <li className="more">+ {rest} more item{rest > 1 ? 's' : ''}</li>}
      </ul>

      <button
        type="button"
        className="ord-meta"
        onClick={() => nav.push(`/track/${order.id}`)}
        aria-label="View order details"
      >
        <span className="ord-meta-left">
          <span className="ord-when">Order placed on {orderDate(order.placedAt)}</span>
          <span className={`ord-status ${order.status === 'delivered' ? 'delivered' : active ? '' : 'cancelled'}`}>
            {statusLabel(order)} <small>· {paymentShort(order)}</small>
          </span>
        </span>
        <span className="ord-total">
          {formatMoney(order.total)} <Icon name="solid:chevron-right" size={11} />
        </span>
      </button>

      <div className="ord-foot">
        {order.status === 'delivered' && (
          <button type="button" className="ghost-link tap" onClick={() => toast('Ratings are part of the demo')}>
            <Icon name="solid:star" size={12} /> Rate
          </button>
        )}
        <button type="button" className="ord-reorder tap" onClick={() => onReorder(order)}>
          <Icon name="solid:rotate-left" size={13} /> Order again
        </button>
      </div>
    </article>
  );
}

function LiveCard({ order }: { order: Order }) {
  const nav = useAppNav();
  const stage = order.status === 'confirmed' ? 1 : order.status === 'preparing' ? 2 : order.status === 'picked_up' ? 3 : 4;
  const labels = ['Placed', 'Preparing', 'Partner', 'On the way'];
  const itemSummary = `${order.lines[0]?.qty ?? 1} × ${order.lines[0]?.name ?? 'Item'}${
    order.lines.length > 1 ? ` + ${order.lines.length - 1} more` : ''
  }`;

  return (
    <div className="order-card track-card">
      <div className="oc-head">
        <div className="oc-logo" aria-hidden="true">
          {initial(order.restaurantName)}
        </div>
        <div className="oc-title">
          <h3 className="oc-name">{order.restaurantName}</h3>
          <div className="oc-sub">
            Order #{order.id} · {formatMoney(order.total)}
          </div>
        </div>
      </div>

      <button className="live-state" type="button" onClick={() => nav.push(`/track/${order.id}`)}>
        <span className="live-state-ico">
          <Icon name="solid:motorcycle" size={16} />
        </span>
        <span className="live-state-text">
          <span className="live-state-title">{statusLabel(order)}</span>
          <span className="live-state-detail">Arriving in {order.eta}</span>
        </span>
      </button>

      <div className="mini-progress" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <div className={`mini-seg${n <= stage ? ' on' : ''}`} key={n}>
            <i />
          </div>
        ))}
      </div>
      <div className="mini-labels" aria-hidden="true">
        {labels.map((label, index) => (
          <span className={index < stage ? 'on' : ''} key={label}>
            {label}
          </span>
        ))}
      </div>

      <div className="live-meta">
        <div className="meta-row">
          <Icon name="solid:bag-shopping" size={13} />
          <span>{itemSummary}</span>
        </div>
        <div className="meta-row">
          <Icon name="solid:location-dot" size={13} />
          <span>{order.address}</span>
        </div>
      </div>

      <div className="live-actions">
        <button className="track-btn tap" type="button" onClick={() => nav.push(`/track/${order.id}`)}>
          View live tracking <Icon name="solid:arrow-right" size={12} />
        </button>
        <button className="icon-btn tap" type="button" aria-label="Call delivery partner" onClick={() => toast('Calling the rider (demo)')}>
          <Icon name="solid:phone" size={14} />
        </button>
        <button className="icon-btn tap" type="button" aria-label="Help with this order" onClick={() => toast('Help centre is not part of this demo')}>
          <Icon name="solid:headset" size={14} />
        </button>
      </div>
    </div>
  );
}

const ordersStyle = createRouteStyleSheet(`${ordersShellCss}\n${ordersBundleCss}\n${navOverride}`, 'navereatOrders');

export function Orders() {
  const nav = useAppNav();
  const orders = useAppStore((s) => s.orders);
  const addItem = useAppStore((s) => s.addItem);
  const [query, setQuery] = useState('');

  useLayoutEffect(() => ordersStyle.attach(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (order) =>
        order.restaurantName.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.lines.some((line) => line.name.toLowerCase().includes(q)),
    );
  }, [orders, query]);

  const live = filtered.filter((order) => ACTIVE_STATUSES.has(order.status));
  const past = filtered.filter((order) => !ACTIVE_STATUSES.has(order.status));

  const reorder = (order: Order) => {
    const restaurant = findRestaurant(order.restaurantId);
    if (!restaurant) {
      toast('This restaurant is not available in the demo', 'error');
      return;
    }
    let added = 0;
    order.lines.forEach((line) => {
      const menuItem = restaurant.menu.find((item) => item.name === line.name);
      if (!menuItem) return;
      for (let index = 0; index < line.qty; index += 1) addItem(menuItem, restaurant.id);
      added += line.qty;
    });
    if (added === 0) {
      toast('Could not reorder these items', 'error');
      return;
    }
    toast(`${added} item${added === 1 ? '' : 's'} added to cart`, 'success');
    nav.push('/cart');
  };

  return (
    <div className="page orders-page">
      <header className="orders-header">
        <div className="header-top">
          <button className="header-back-btn tap" type="button" onClick={() => nav.tab('/')} aria-label="Go back" />
          <div className="header-titles">
            <h1>My Orders</h1>
          </div>
        </div>
        <div className="header-stats">
          <span>{orders.length} order{orders.length === 1 ? '' : 's'}</span>
          {live.length > 0 && (
            <span className="stat-live">
              <span className="pulse-dot-sm" />
              {live.length} live
            </span>
          )}
        </div>
        <div className={`search-bar${query ? ' has-value' : ''}`}>
          <Icon name="solid:magnifying-glass" size={15} />
          <input
            type="search"
            placeholder="Search by restaurant or dish"
            autoComplete="off"
            aria-label="Search orders"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button className="search-clear tap" type="button" aria-label="Clear search" onClick={() => setQuery('')}>
              <Icon name="solid:xmark" size={11} />
            </button>
          )}
        </div>
      </header>

      <div className="orders-content">
        {live.length > 0 && (
          <>
            <div className="section-title">
              <div className="st-left">
                Active orders <span className="pulse-dot-sm" />
              </div>
              <div className="st-count">{live.length} active</div>
            </div>
            {live.map((order) => (
              <LiveCard order={order} key={order.id} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: live.length ? 20 : 4 }}>
              <div className="st-left">Past orders</div>
              <div className="st-count">{past.length} total</div>
            </div>
            {past.map((order) => (
              <PastCard order={order} onReorder={reorder} key={order.id} />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <div className="empty-card">
            <div className="empty-illustration">
              <Icon name="solid:bag-shopping" size={56} />
            </div>
            <h4>{query ? 'No matching orders' : 'No orders found'}</h4>
            <p>{query ? 'Try another restaurant or dish.' : "Looks like you haven't placed any orders yet."}</p>
            <button className="explore-btn tap" type="button" onClick={() => nav.tab('/')}>
              Explore restaurants
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
