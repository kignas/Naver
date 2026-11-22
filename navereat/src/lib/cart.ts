import type { Coupon } from '../data/demo';
import { PLATFORM_FEE } from '../data/demo';

export interface CartLine {
  quantity: number;
  price: number;
  resId: number;
}

export type Cart = Record<string, CartLine>;

export interface Bill {
  items: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  total: number;
  freeDelivery: boolean;
}

export const cartCount = (cart: Cart): number =>
  Object.values(cart).reduce((sum, line) => sum + line.quantity, 0);

export const cartSubtotal = (cart: Cart): number =>
  Object.values(cart).reduce((sum, line) => sum + line.quantity * line.price, 0);

export const couponDiscount = (coupon: Coupon | null, subtotal: number): number => {
  if (!coupon || subtotal < coupon.minOrder) return 0;
  if (coupon.type === 'flat') return Math.min(coupon.value, subtotal);
  const raw = Math.floor((subtotal * coupon.value) / 100);
  return Math.min(raw, coupon.maxDiscount ?? raw);
};

/**
 * Legacy cart behaviour: the bill summary always showed delivery as FREE
 * (the "free above ₹149" banner was marketing copy only), so the port keeps
 * exactly the same totals: subtotal + ₹5 platform fee.
 */
export const billFor = (cart: Cart, coupon: Coupon | null = null): Bill => {
  const subtotal = cartSubtotal(cart);
  const discount = couponDiscount(coupon, subtotal);
  return {
    items: cartCount(cart),
    subtotal,
    deliveryFee: 0,
    platformFee: PLATFORM_FEE,
    discount,
    total: Math.max(0, subtotal + PLATFORM_FEE - discount),
    freeDelivery: true,
  };
};

export const cartRestaurantId = (cart: Cart): number | null => {
  const first = Object.values(cart)[0];
  return first ? first.resId : null;
};
