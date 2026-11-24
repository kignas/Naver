import type { Restaurant } from '../../data/demo';
import type { CartLine } from '../../lib/cart';

/** Pre-discount price for a cart line: the line's own value, else the menu item's. */
export function cartLineOriginalPrice(restaurant: Restaurant | undefined, line: CartLine): number {
  const explicit = Number(line.originalPrice ?? 0);
  if (explicit > line.price) return explicit;
  const menuItem = restaurant?.menu.find((item) => item.id === line.menuItem);
  const fromMenu = Number(menuItem?.originalPrice ?? 0);
  return fromMenu > line.price ? fromMenu : 0;
}
