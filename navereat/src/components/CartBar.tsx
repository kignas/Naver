import type { ReactNode } from 'react';
import { cartCount, cartSubtotal } from '../lib/cart';
import { itemWord, formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { Icon } from './Icon';

interface CartBarProps {
  subtitle?: ReactNode;
  aboveNav?: boolean;
  onViewCart?: () => void;
}

export function CartBar({ subtitle, aboveNav = false, onViewCart }: CartBarProps) {
  const cart = useAppStore((s) => s.cart);
  const nav = useAppNav();
  const count = cartCount(cart);
  if (count === 0) return null;
  const total = cartSubtotal(cart);

  return (
    <div className={`cart-bar${aboveNav ? ' cart-bar--above-nav' : ''}`} role="status">
      <div className="cart-bar-left">
        <div className="cart-bar-icon">
          <Icon name="solid:bag-shopping" size={15} />
        </div>
        <div>
          <p className="cart-bar-summary">
            {count} {itemWord(count)} &nbsp;|&nbsp; {formatMoney(total)}
          </p>
          <p className="cart-bar-sub">{subtitle ?? 'Extra charges may apply'}</p>
        </div>
      </div>
      <button type="button" className="cart-bar-btn tap-soft" onClick={onViewCart ?? (() => nav.push('/cart'))}>
        VIEW CART <Icon name="solid:chevron-right" size={10} />
      </button>
    </div>
  );
}
