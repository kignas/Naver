import { useAppNav } from '../../lib/navigation';
import { useAppStore } from '../../store/appStore';
import { cartLineOriginalPrice } from './cartPricing';
import { CartLineRow } from './CartLineRow';
import { useCartTotals } from './cartTotals';

interface CartItemsProps {
  note: string;
  cutlery: boolean;
  onCutleryChange: (checked: boolean) => void;
  onOpenNote: () => void;
}

export function CartItems({ note, cutlery, onCutleryChange, onOpenNote }: CartItemsProps) {
  const nav = useAppNav();
  const setQty = useAppStore((state) => state.setQty);
  const { groups, restaurant } = useCartTotals();

  return (
    <div className="ct-card ct-item-card">
      <div aria-live="polite" id="cart-items-list">
        {groups.map((group, groupIndex) => (
          <section className="ct-restaurant-group" data-restaurant-id={group.resId} key={group.resId}>
            <div className="ct-restaurant-head">
              <div className="ct-restaurant-copy">
                <div className="ct-restaurant-name">{group.name}</div>
                <div className="ct-restaurant-meta">
                  {group.units} {group.units === 1 ? 'item' : 'items'} · ₹{group.subtotal}
                </div>
              </div>
            </div>
            <div className="ct-restaurant-items">
              {group.lines.map(({ name, line }) => (
                <CartLineRow
                  key={name}
                  name={name}
                  line={line}
                  original={cartLineOriginalPrice(restaurant, line)}
                  onQty={setQty}
                />
              ))}
            </div>
            <div className="ct-item-actions ct-group-actions">
              <button className="ct-pill-btn tap" type="button" onClick={() => nav.push(`/restaurant/${group.resId}`)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                Add Items
              </button>
              <button className="ct-pill-btn tap" type="button" onClick={onOpenNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 19h14M7 15l9-9 2 2-9 9H7v-2z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="ct-note-btn-text">{note ? 'Request added' : 'Cooking requests'}</span>
              </button>
              {groupIndex === 0 && (
                <label className="ct-pill-btn ct-cutlery-chip tap">
                  <input
                    type="checkbox"
                    checked={cutlery}
                    onChange={(event) => onCutleryChange(event.target.checked)}
                  />
                  <span className="ct-cutlery-box" aria-hidden="true" />
                  <span>Cutlery Needed</span>
                </label>
              )}
            </div>
            {note && <div className="ct-restaurant-note-preview">{note}</div>}
          </section>
        ))}
      </div>
    </div>
  );
}
