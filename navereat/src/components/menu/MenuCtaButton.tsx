import type { MenuItem } from '../../data/demo';
import { customizedQtyFor, isCustomisable } from '../../lib/customization';
import { tapHaptic } from '../../lib/haptics';
import { useCustomize } from '../../lib/customizeContext';
import { useAppStore } from '../../store/appStore';

interface MenuCtaButtonProps {
  item: MenuItem;
  resId: number;
}

/** The dish action exactly as `window.makeBtnHTML` renders it (Nearbite 0cca76b). */
export function MenuCtaButton({ item, resId }: MenuCtaButtonProps) {
  const { openCustomize } = useCustomize();
  const qty = useAppStore((state) => state.cart[item.name]?.quantity ?? 0);
  const customisable = isCustomisable(item);
  const customQty = useAppStore((state) => (customisable ? customizedQtyFor(state.cart, item) : 0));
  const addItem = useAppStore((state) => state.addItem);
  const decrementItem = useAppStore((state) => state.decrementItem);
  const removeCustomizedUnit = useAppStore((state) => state.removeCustomizedUnit);

  if (item.available === false) {
    return (
      <button type="button" className="nb-add-btn is-disabled" disabled>
        Unavailable
      </button>
    );
  }

  if (customisable) {
    const button = (
      <button
        type="button"
        className={`nb-add-btn nb-add-btn--cust${customQty > 0 ? ' has-cart-qty' : ''}`}
        data-menu-item-id={item.id}
        aria-label={`Customise ${item.name}${customQty > 0 ? `, ${customQty} in cart` : ''}`}
        onClick={() => {
          tapHaptic();
          openCustomize(item, resId);
        }}
      >
        ADD <span className="nb-add-plus" aria-hidden="true">+</span>
        {customQty > 0 && (
          <span className="nb-custom-qty" aria-hidden="true">
            {customQty}
          </span>
        )}
      </button>
    );
    if (customQty > 0) {
      return (
        <div className="nb-custom-cart-control">
          <button
            type="button"
            className="nb-custom-remove"
            onClick={() => {
              tapHaptic();
              removeCustomizedUnit(item);
            }}
            aria-label={`Remove one ${item.name} from cart`}
          >
            −
          </button>
          {button}
        </div>
      );
    }
    return button;
  }

  if (qty > 0) {
    return (
      <div className="nb-qty" role="group" aria-label="Quantity">
        <button
          type="button"
          className="nb-qty-btn"
          onClick={() => {
            tapHaptic();
            decrementItem(item.name);
          }}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="nb-qty-val">{qty}</span>
        <button
          type="button"
          className="nb-qty-btn"
          onClick={() => {
            tapHaptic();
            addItem(item, resId);
          }}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="nb-add-btn"
      onClick={() => {
        tapHaptic();
        addItem(item, resId);
      }}
      aria-label={`Add ${item.name} to cart`}
    >
      ADD
    </button>
  );
}
