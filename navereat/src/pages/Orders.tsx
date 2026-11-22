import { useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import { findRestaurant, type Order } from '../data/demo';
import { cartCount, cartSubtotal } from '../lib/cart';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import '../styles/pages/orders.css';

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

const orderDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function Orders() {
  const nav = useAppNav();
  const cart = useAppStore((s) => s.cart);
  const orders = useAppStore((s) => s.orders);
  const addItem = useAppStore((s) => s.addItem);
  const [query, setQuery] = useState('');

  const count = cartCount(cart);
  const cartTotal = cartSubtotal(cart);
  const cartRestaurant = findRestaurant(Object.values(cart)[0]?.resId);

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
          <button type="button" className="orders-back tap" onClick={() => nav.tab('/')} aria-label="Back">
            <Icon name="solid:arrow-left" size={14} />
          </button>
          <h1 className="orders-title">My Orders</h1>
      </header>

      <div className="page-scroll orders-scroll">
        <div style={{ paddingTop: 20 }}>
          <div className="orders-search">
            <Icon name="solid:magnifying-glass" size={14} />
            <input
              type="text"
              placeholder="Search your past orders..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search past orders"
            />
          </div>

          {count > 0 && (
            <div>
              <div className="orders-section-label">
                <h2 className="orders-label">Current Order</h2>
                <span className="orders-live-dot" />
              </div>
              <div className="bag-card">
                <div className="bag-top">
                  <div>
                    <h3 className="bag-title">Items in your bag</h3>
                    <p className="bag-sub">
                      {cartRestaurant?.name ?? 'Your cart'} · {count} item{count === 1 ? '' : 's'} ·{' '}
                      {formatMoney(cartTotal)}
                    </p>
                  </div>
                  <div className="bag-icon">
                    <Icon name="solid:bag-shopping" size={14} />
                  </div>
                </div>
                <div className="bag-progress">
                  <div className="bag-progress-fill" />
                </div>
                <div className="bag-steps">
                  <span className="done">Added</span>
                  <span className="todo">Confirmed</span>
                  <span className="todo">Delivered</span>
                </div>
                <button type="button" className="bag-btn" onClick={() => nav.push('/cart')}>
                  View Cart &amp; Checkout
                </button>
              </div>
            </div>
          )}

          {orders.length === 0 && count === 0 ? (
            <div className="orders-empty">
              <div className="orders-empty-icon">
                <Icon name="solid:bag-shopping" size={36} />
              </div>
              <h4>No orders yet</h4>
              <p>
                Your order history will appear here
                <br />
                after you place your first order
              </p>
              <button type="button" className="orders-empty-btn" onClick={() => nav.tab('/')}>
                Explore Navereat
              </button>
            </div>
          ) : (
            <div>
              <div className="orders-section-label">
                <h2 className="orders-label" style={{ color: 'var(--g400)' }}>
                  Past Orders
                </h2>
              </div>
              {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--g400)', padding: '32px 0' }}>
                  No orders match &quot;{query}&quot;.
                </p>
              ) : (
                filtered.map((order) => {
                  const active = order.status !== 'delivered' && order.status !== 'cancelled';
                  return (
                    <div className="order-card" key={order.id}>
                      <div className="order-top">
                        <div>
                          <h3 className="order-rest">{order.restaurantName}</h3>
                          <p className="order-id">{order.id}</p>
                        </div>
                        <span className={`status-pill ${order.status === 'cancelled' ? 'cancelled' : active ? 'active' : 'delivered'}`}>
                          {statusLabel(order)}
                        </span>
                      </div>
                      <p className="order-items">
                        {order.lines.map((line) => `${line.qty} × ${line.name}`).join(', ')}
                      </p>
                      <div className="order-bottom">
                        <div>
                          <p className="order-total">{formatMoney(order.total)}</p>
                          <p className="order-date">{orderDate(order.placedAt)}</p>
                        </div>
                        {active ? (
                          <button type="button" className="order-track tap" onClick={() => nav.push(`/track/${order.id}`)}>
                            Track <Icon name="solid:chevron-right" size={9} />
                          </button>
                        ) : (
                          <button type="button" className="order-track tap" onClick={() => reorder(order)}>
                            Reorder <Icon name="solid:rotate-left" size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
