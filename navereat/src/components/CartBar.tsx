import { useEffect, useMemo, useRef, useState } from 'react';
import { findRestaurant } from '../data/demo';
import { cartCount, cartSubtotal, type Cart } from '../lib/cart';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { Icon } from './Icon';
import '../styles/original/cart-bar.css';
import '../styles/original/cart-bar-overrides.css';

export type CartBarMode = 'home' | 'pink';

interface CartBarProps {
  visible?: boolean;
  mode?: CartBarMode;
  aboveNav?: boolean;
}

interface CartGroup {
  id: string;
  name: string;
  units: number;
  image: string;
}

const CART_SVG = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.16L21 8H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9.5" cy="20" r="1.4" fill="currentColor" />
    <circle cx="17.5" cy="20" r="1.4" fill="currentColor" />
  </svg>
);

const UP_SVG = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const formatCurrency = (value: number): string => `₹${Math.round(value).toLocaleString('en-IN')}`;

function groupsFor(cart: Cart): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  Object.entries(cart).forEach(([, line]) => {
    if (!line || Number(line.quantity) <= 0) return;
    const id = String(line.resId ?? 'unknown');
    const restaurant = findRestaurant(line.resId);
    const group =
      groups.get(id) ??
      ({
        id,
        name: line.resName ?? restaurant?.name ?? 'Restaurant',
        units: 0,
        image: line.image ?? restaurant?.image ?? '',
      } satisfies CartGroup);
    group.units += Math.max(0, Number(line.quantity) || 0);
    if (!group.image) group.image = line.image ?? restaurant?.image ?? '';
    if ((!group.name || group.name === 'Restaurant') && line.resName) group.name = line.resName;
    groups.set(id, group);
  });
  return [...groups.values()];
}

function useBodyLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

function CartDrawer({
  groups,
  open,
  onClose,
  onCheckout,
}: {
  groups: CartGroup[];
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useBodyLock(shown);

  return (
    <div id="ew-cart-drawer-backdrop" className={shown ? 'show' : ''}>
      <section id="ew-cart-drawer" className={shown ? 'show' : ''} role="dialog" aria-modal="true" aria-label="Your carts">
        <div className="ew-cd-head">
          <div className="ew-cd-title" id="ew-cd-title">
            Your Carts ({groups.length})
          </div>
          <button className="ew-cd-close" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ew-cd-list" id="ew-cd-list">
          {groups.length ? (
            groups.map((group) => {
              const units = Math.round(group.units);
              return (
                <div className="ew-cd-row" key={group.id}>
                  {group.image ? <img className="ew-cd-logo" src={group.image} alt="" /> : <span className="ew-cd-logo" />}
                  <div className="ew-cd-info">
                    <div className="ew-cd-name">{group.name}</div>
                    <div className="ew-cd-menu">
                      View Menu <span className="ew-cd-arrow">›</span>
                    </div>
                  </div>
                  <button className="ew-cd-view" type="button" data-cd-view={group.id} onClick={onCheckout}>
                    <strong>View Cart</strong>
                    <span>
                      {units} {units === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="ew-cd-empty">Your cart is empty.</div>
          )}
        </div>
        <div className="ew-cd-footer">
          <button className="ew-cd-checkout" type="button" id="ew-cd-checkout" onClick={onCheckout}>
            Checkout all <span>›</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function CartBar({ visible = true, mode = 'home', aboveNav = false }: CartBarProps) {
  const cart = useAppStore((state) => state.cart);
  const clearCart = useAppStore((state) => state.clearCart);
  const nav = useAppNav();

  const count = cartCount(cart);
  const [mounted, setMounted] = useState(visible && count > 0);
  const [exiting, setExiting] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinkPulse, setPinkPulse] = useState('');
  const lastCart = useRef<Cart>(cart);
  const lastCount = useRef(count);
  const pinkCount = useRef(count);
  const countRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const pinkTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setMounted(false);
      setExiting(false);
      return;
    }
    if (count > 0) {
      lastCart.current = cart;
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [visible, count, cart, mounted]);

  useEffect(() => {
    if (!visible || count === 0) setClearConfirm(false);
  }, [visible, count]);

  useEffect(() => {
    if (count === 0) return;
    if (lastCount.current !== count) {
      const bump = (element: HTMLElement | null) => {
        if (!element) return;
        element.classList.remove('wc-bump');
        void element.offsetWidth;
        element.classList.add('wc-bump');
      };
      bump(countRef.current);
      bump(badgeRef.current);
      lastCount.current = count;
    }
  }, [count]);

  useEffect(() => {
    if (mode !== 'pink' || count === 0) return;
    if (pinkCount.current === count) return;
    pinkCount.current = count;
    setPinkPulse((current) => (current === 'wc-cart-update' ? 'wc-cart-update-alt' : 'wc-cart-update'));
    if (pinkTimer.current) window.clearTimeout(pinkTimer.current);
    pinkTimer.current = window.setTimeout(() => setPinkPulse(''), 260);
    return () => {
      if (pinkTimer.current) window.clearTimeout(pinkTimer.current);
    };
  }, [count, mode]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'nearbite_cart') return;
      try {
        const next = event.newValue ? (JSON.parse(event.newValue) as Cart) : {};
        useAppStore.setState({ cart: next });
      } catch {
        /* ignore malformed cross-tab payloads */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const displayCart = count > 0 ? cart : lastCart.current;
  const displayCount = cartCount(displayCart);
  const total = cartSubtotal(displayCart);
  const entries = Object.entries(displayCart).filter(([, line]) => line.quantity > 0);
  const lastEntry = entries[entries.length - 1];
  const lastLine = lastEntry?.[1];
  const lastRestaurant = findRestaurant(lastLine?.resId);
  const restaurantName = lastLine?.resName ?? lastRestaurant?.name ?? lastEntry?.[0] ?? 'Navereat Order';
  const images = entries
    .slice(-3)
    .reverse()
    .map(([name, line]) => {
      const restaurant = findRestaurant(line.resId);
      const menuItem = restaurant?.menu.find((item) => item.name === name);
      return line.image ?? menuItem?.image ?? restaurant?.image;
    })
    .filter((image): image is string => Boolean(image));
  const stackWidth = images.length <= 1 ? '36px' : images.length === 2 ? '48px' : '60px';
  const groups = useMemo(() => groupsFor(displayCart), [displayCart]);
  const showAllUp = mode === 'home' && groups.length >= 2;
  const showClear = clearConfirm && displayCount > 0;
  const deliveryMessage =
    displayCount > 0 ? 'Your order is ready to review' : 'Your cart is ready';

  if (!mounted) {
    return (
      <CartDrawer
        groups={groups}
        open={false}
        onClose={() => setDrawerOpen(false)}
        onCheckout={() => nav.push('/cart')}
      />
    );
  }

  const openCart = () => {
    if (mode === 'home' && groups.length >= 2) {
      setDrawerOpen(true);
      return;
    }
    nav.push('/cart');
  };

  const clearEverything = () => {
    try {
      localStorage.removeItem('nearbite_checkout_key');
      localStorage.removeItem('nearbite_checkout_fp');
      localStorage.removeItem('nearbite_checkout_fp_ts');
    } catch {
      /* storage can be unavailable */
    }
    clearCart();
    setClearConfirm(false);
  };

  return (
    <>
      <div
        id="white-cart-root"
        className={[
          mode === 'pink' ? 'wc-pink' : '',
          aboveNav ? 'wc-above-nav' : '',
          exiting ? 'wc-exiting' : 'wc-enter',
          pinkPulse,
        ]
          .filter(Boolean)
          .join(' ')}
        role="status"
        style={{ display: 'block' }}
      >
        {mode === 'home' ? (
          <>
            <button
              type="button"
              id="wc-allup"
              className={showAllUp ? 'show' : ''}
              aria-label="View all restaurant carts"
              onClick={(event) => {
                event.stopPropagation();
                setDrawerOpen(true);
              }}
            >
              All {UP_SVG}
            </button>
            <div id="white-cart-container">
              <button type="button" className="wc-left" aria-label="View cart" onClick={openCart}>
                <div className="wc-thumb-wrap">
                  <div className="wc-image-stack" id="wc-dynamic-img-stack" style={{ width: stackWidth }}>
                    {images.map((image, index) => (
                      <img className="wc-img" src={image} alt="" key={`${image}-${index}`} />
                    ))}
                  </div>
                  <span className="wc-qty-badge" id="wc-qty-badge" aria-hidden="true" ref={badgeRef}>
                    {displayCount > 99 ? '99+' : displayCount}
                  </span>
                </div>
                <div className="wc-info">
                  <div className="wc-res-name" id="wc-dynamic-res">
                    {restaurantName}
                  </div>
                  <div className="wc-menu-link">
                    Added to cart <Icon name="solid:check" size={10} />
                  </div>
                </div>
              </button>
              <div className="wc-right">
                <div id="wc-standard-actions" style={{ display: showClear ? 'none' : 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="wc-btn" onClick={openCart}>
                    <span className="wc-btn-title">View Cart {CART_SVG}</span>
                    <span className="wc-btn-sub" id="wc-item-count" aria-live="polite" ref={countRef}>
                      {displayCount} {displayCount === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wc-close"
                    id="wc-close-btn"
                    aria-label="Clear cart"
                    onClick={(event) => {
                      event.stopPropagation();
                      setClearConfirm(true);
                    }}
                  >
                    <Icon name="solid:xmark" size={15} />
                  </button>
                </div>
                <div id="wc-clear-actions" style={{ display: showClear ? 'flex' : 'none', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="wc-btn"
                    id="wc-confirm-clear"
                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #D64545 100%)' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      clearEverything();
                    }}
                  >
                    <span className="wc-btn-title">Clear Cart</span>
                    <span className="wc-btn-sub">Remove all items</span>
                  </button>
                  <button
                    type="button"
                    className="wc-close"
                    id="wc-cancel-clear"
                    aria-label="Cancel, keep cart items"
                    onClick={(event) => {
                      event.stopPropagation();
                      setClearConfirm(false);
                    }}
                  >
                    <Icon name="solid:arrow-right-long" size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <button type="button" id="es-pink-inner" aria-label="View cart" onClick={() => nav.push('/cart')}>
            <span className="wc-pink-message" id="wc-delivery-message" aria-live="polite">
              <span className="wc-delivery-message-icon" aria-hidden="true">
                ✦
              </span>
              <span id="wc-delivery-message-text">{deliveryMessage}</span>
            </span>
            <span className="wc-pink-main">
              <span className="wc-pink-left" id="wc-item-count" aria-live="polite" ref={countRef}>
                {displayCount} {displayCount === 1 ? 'item' : 'items'} · {formatCurrency(total)}
              </span>
              <span className="wc-pink-cta">View Cart {CART_SVG}</span>
            </span>
          </button>
        )}
      </div>

      <CartDrawer
        groups={groups}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCheckout={() => {
          setDrawerOpen(false);
          nav.push('/cart');
        }}
      />

    </>
  );
}
