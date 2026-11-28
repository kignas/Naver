import { createContext, useContext } from 'react';
import type { DemoOffer, Restaurant } from '../../data/demo';
import type { Bill, Cart, CartLine } from '../../lib/cart';
import type { PaymentSettings, PaymentState } from '../../logic/paymentOptions';
import type { BelowMinGroup, CtaView } from '../../logic/checkoutCta';

export interface CartGroup {
  resId: number;
  name: string;
  lines: Array<{ name: string; line: CartLine }>;
  units: number;
  subtotal: number;
  /** `restaurant.minOrder`, the legacy `rows[].minOrder` source. */
  minOrder?: number;
}

/** What the payment selector needs to render, derived once per cart state. */
export interface CartPaymentOptions {
  settings: PaymentSettings;
  cod: PaymentState;
  upi: PaymentState;
  /** More than one eligible method: the pay sheet opens instead of ordering. */
  choice: boolean;
  method: 'upi' | 'cod';
  ctaLabel: string;
  payNote: string;
  block: { label: string; sub: string } | null;
}

export interface CartTotals {
  cart: Cart;
  groups: CartGroup[];
  subtotal: number;
  offers: DemoOffer[];
  bill: Bill;
  savings: number;
  totalSavings: number;
  freeDelivery: boolean;
  restaurant: Restaurant | undefined;
  paymentOptions: CartPaymentOptions;
  /** `ctState.multiBelowMin`, feeding the CTA and the "add ₹x more" toast. */
  multiBelowMin: BelowMinGroup[];
  /** The `updateCheckoutCta()` outcome: label, sub-label and lock state. */
  cta: CtaView;
}

export const CartTotalsContext = createContext<CartTotals | null>(null);

export function useCartTotals(): CartTotals {
  const value = useContext(CartTotalsContext);
  if (!value) throw new Error('useCartTotals must be used inside CartTotalsProvider');
  return value;
}
