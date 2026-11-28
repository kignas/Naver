import type { Coupon, DemoOffer } from '../data/demo';

/** The legacy cart charges no platform fee (see PARITY.md §2.2). */
export const PLATFORM_FEE = 0;

export interface CartCustomization {
  title: string;
  label: string;
  extraPrice: number;
  pricingMode: 'extra' | 'portion';
  isVeg: boolean;
}

export interface CartLine {
  quantity: number;
  price: number;
  resId: number;
  isVeg?: boolean;
  originalPrice?: number;
  image?: string;
  resName?: string;
  restaurantName?: string;
  menuItem?: string;
  name?: string;
  customizations?: CartCustomization[];
}

export type Cart = Record<string, CartLine>;

export interface Bill {
  items: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  offerDiscount: number;
  total: number;
  freeDelivery: boolean;
}

export const cartCount = (cart: Cart): number =>
  Object.values(cart).reduce((sum, line) => sum + line.quantity, 0);

export const cartSubtotal = (cart: Cart): number =>
  Object.values(cart).reduce((sum, line) => sum + line.quantity * line.price, 0);

export const offerDiscountFor = (offers: DemoOffer[]): number =>
  offers.reduce((sum, offer) => sum + (offer.kind === 'discount' ? offer.amount : 0), 0);

export const couponDiscount = (coupon: Coupon | null, subtotal: number): number => {
  if (!coupon || subtotal < coupon.minOrder) return 0;
  if (coupon.type === 'flat') return Math.min(coupon.value, subtotal);
  const raw = Math.floor((subtotal * coupon.value) / 100);
  return Math.min(raw, coupon.maxDiscount ?? raw);
};

/**
 * Legacy cart behaviour: delivery is free and checkout charges no platform fee,
 * matching the original cart bill (item total + delivery only).
 */
export const billFor = (cart: Cart, coupon: Coupon | null = null, offers: DemoOffer[] = []): Bill => {
  const subtotal = cartSubtotal(cart);
  const discount = couponDiscount(coupon, subtotal);
  const offerDiscount = offerDiscountFor(offers);
  return {
    items: cartCount(cart),
    subtotal,
    deliveryFee: 0,
    platformFee: PLATFORM_FEE,
    discount,
    offerDiscount,
    total: Math.max(0, subtotal + PLATFORM_FEE - discount - offerDiscount),
    freeDelivery: true,
  };
};

export const cartRestaurantId = (cart: Cart): number | null => {
  const first = Object.values(cart)[0];
  return first ? first.resId : null;
};
