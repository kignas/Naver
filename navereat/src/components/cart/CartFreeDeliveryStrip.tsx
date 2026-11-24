import { Icon } from '../Icon';
import { useCartTotals } from './cartTotals';

export function CartFreeDeliveryStrip() {
  const { freeDelivery } = useCartTotals();
  if (!freeDelivery) return null;
  return (
    <div className="ct-strip" id="free-delivery-nudge" role="status">
      <Icon name="solid:motorcycle" size={18} />
      <span className="ct-strip-copy">
        <span id="nudge-text">Free delivery unlocked</span>
        <span className="ct-strip-sub" id="nudge-sub">
          No delivery charge on this order
        </span>
      </span>
    </div>
  );
}
