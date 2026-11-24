import { memo } from 'react';
import { customTextFor, displayNameFor } from '../../lib/customization';
import type { CartLine } from '../../lib/cart';

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

interface CartLineRowProps {
  name: string;
  line: CartLine;
  original: number;
  onQty: (name: string, qty: number) => void;
}

export const CartLineRow = memo(
  function CartLineRow({ name, line, original, onQty }: CartLineRowProps) {
    const perfWindow = window as Window & { __cartItemRenders?: number };
    perfWindow.__cartItemRenders = (perfWindow.__cartItemRenders ?? 0) + 1;
    const customText = customTextFor(line.customizations);
    const shownName = displayNameFor(name, customText);
    const hasDiscount = original > line.price;
    const discountPct = hasDiscount ? Math.round(((original - line.price) / original) * 100) : 0;
    const itemTotal = line.quantity * line.price;
    const itemSavings = hasDiscount ? line.quantity * (original - line.price) : 0;
    const last = line.quantity <= 1;
    return (
      <div className="ct-row" data-name={name}>
        <div className="ct-info">
          <div className="ct-name-row">
            <VegMark value={line.isVeg} />
            <span className="ct-name">{shownName}</span>
          </div>
          {customText && <div className="ct-custom">{customText}</div>}
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
              onClick={() => onQty(name, line.quantity - 1)}
            >
              {last ? trashIcon : <span className="ct-step-glyph" aria-hidden="true">−</span>}
            </button>
            <span className="ct-qty">{line.quantity}</span>
            <button
              type="button"
              className="ct-step-up"
              aria-label="Increase quantity"
              onClick={() => onQty(name, line.quantity + 1)}
            >
              <span className="ct-step-glyph" aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.name === next.name &&
    prev.line === next.line &&
    prev.original === next.original &&
    prev.onQty === next.onQty,
);
