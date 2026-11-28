import type { Coupon, DemoOffer } from '../data/demo';
import type { QuoteBill } from '../logic/bill';

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
  baseDeliveryFee: number;
  deliverySubsidy: number;
  packagingFee: number;
  platformFee: number;
  tax: number;
  smallOrderFee: number;
  codFee: number;
  discount: number;
  offerDiscount: number;
  /** Grand total before tip, exactly as the quote returns it. */
  total: number;
  /** Restaurant → customer distance from the quote, for the bill label. */
  distanceKm?: number;
  grandTotal: number;
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
    baseDeliveryFee: 0,
    deliverySubsidy: 0,
    packagingFee: 0,
    platformFee: PLATFORM_FEE,
    tax: 0,
    smallOrderFee: 0,
    codFee: 0,
    discount,
    offerDiscount,
    total: Math.max(0, subtotal + PLATFORM_FEE - discount - offerDiscount),
    grandTotal: Math.max(0, subtotal + PLATFORM_FEE - discount - offerDiscount),
    freeDelivery: true,
  };
};

/**
 * View model for the bill sheet, built from the engine quote the demo endpoint
 * returns. Delivery, GST and the small-order fee come from the quote; packaging
 * and the platform fee are ₹0, exactly as the legacy bill strip states.
 */
export const billFromQuote = (
  cart: Cart,
  quote: { bill: QuoteBill; distance?: { restaurantToCustomerKm?: number } },
  policy: { packagingPerItem: number; platformFee: number },
): Bill => {
  const units = cartCount(cart);
  const round = (value: number) => Math.round(value * 100) / 100;
  const packagingFee = round(policy.packagingPerItem * units);
  const platformFee = round(policy.platformFee);
  const qb = quote.bill;
  return {
    items: units,
    subtotal: qb.customerFoodSubtotal ?? 0,
    deliveryFee: qb.deliveryFee ?? 0,
    baseDeliveryFee: qb.baseDeliveryFee ?? 0,
    deliverySubsidy: qb.deliverySubsidy ?? 0,
    packagingFee,
    platformFee,
    tax: qb.taxAmount ?? 0,
    smallOrderFee: qb.smallOrderFee ?? 0,
    codFee: qb.codFee ?? 0,
    discount: qb.couponDiscount ?? 0,
    offerDiscount: 0,
    total: qb.total ?? 0,
    grandTotal: qb.grandTotal ?? 0,
    distanceKm: quote.distance?.restaurantToCustomerKm,
    freeDelivery: (qb.deliverySubsidy ?? 0) > 0,
  };
};

export const cartRestaurantId = (cart: Cart): number | null => {
  const first = Object.values(cart)[0];
  return first ? first.resId : null;
};
